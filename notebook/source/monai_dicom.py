# Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import argparse
import json
import logging
import os
import sys
import torch
import torch.distributed as dist
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
import torch.utils.data
import torch.utils.data.distributed
from torch.utils.data import Dataset, DataLoader
import torchvision
import numpy as np
from PIL import Image
from monai.config import print_config
from monai.transforms import \
    Compose, LoadImage, Resize, ScaleIntensity, ToTensor, RandRotate, RandFlip, RandZoom
from monai.networks.nets import densenet121

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
logger.addHandler(logging.StreamHandler(sys.stdout))


class DICOMDataset(Dataset):

    def __init__(self, image_files, labels, transforms):
        self.image_files = image_files
        self.labels = labels
        self.transforms = transforms

    def __len__(self):
        return len(self.image_files)

    def __getitem__(self, index):
        return self.transforms(self.image_files[index]), self.labels[index]


def _get_train_data_loader(batch_size, trainX, trainY, is_distributed, **kwargs):
    logger.info("Get train data loader")
    
    train_transforms = Compose([
        LoadImage(image_only=True),
        ScaleIntensity(),
        RandRotate(range_x=15, prob=0.5, keep_size=True),
        RandFlip(spatial_axis=0, prob=0.5),
        RandZoom(min_zoom=0.9, max_zoom=1.1, prob=0.5, keep_size=True),
        Resize(spatial_size=(108,96)),
        ToTensor()
    ])
    
    dataset = DICOMDataset(trainX, trainY, train_transforms)
    
    train_sampler = torch.utils.data.distributed.DistributedSampler(dataset) if is_distributed else None
    return torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=train_sampler is None,
                                       sampler=train_sampler, **kwargs)


def train(args):
    is_distributed = len(args.hosts) > 1 and args.backend is not None
    logger.debug("Distributed training - {}".format(is_distributed))
    use_cuda = args.num_gpus > 0
    logger.debug("Number of gpus available - {}".format(args.num_gpus))
    kwargs = {'num_workers': 10, 'pin_memory': True} if use_cuda else {}
    device = torch.device("cuda" if use_cuda else "cpu")
        
    if is_distributed:
        # Initialize the distributed environment.
        world_size = len(args.hosts)
        os.environ['WORLD_SIZE'] = str(world_size)
        host_rank = args.hosts.index(args.current_host)
        os.environ['RANK'] = str(host_rank)
        dist.init_process_group(backend=args.backend, rank=host_rank, world_size=world_size)
        logger.debug('Initialized the distributed environment: \'{}\' backend on {} nodes. '.format(
            args.backend, dist.get_world_size()) + 'Current host rank is {}. Number of gpus: {}'.format(
            dist.get_rank(), args.num_gpus))

    # set the seed for generating random numbers
    torch.manual_seed(args.seed)
    if use_cuda:
        torch.cuda.manual_seed(args.seed)
        
    #build file lists
    image_label_list = []
    image_file_list = []
    metadata = args.data_dir+'/meta-data.json'   
    
    # Load Labels
    with open(metadata) as f:
        manifest = json.load(f)
        class_names = list(json.loads(manifest[0]['annotations'][0]['annotationData']['content'])['disease'].keys())
        num_class = len(class_names)
    
    for i, j in enumerate(manifest):
        label_dict = json.loads(json.loads(manifest[i]['annotations'][0]['annotationData']['content'])['labels'])
        filename = args.data_dir+'/'+str([label_dict['imageurl']]).split("/file")[0].split("instances/")[1] + '.dcm'
        image_file_list.append(filename)
        image_label_list.extend([class_names.index(label_dict['label'][0])])
    
    print("Training count =",len(image_file_list))
            
    train_loader = _get_train_data_loader(args.batch_size, image_file_list, image_label_list, False, **kwargs)

    #create model
    model = densenet121(
        spatial_dims=2,
        in_channels=1,
        out_channels=num_class
    ).to(device)
    loss_function = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), 1e-5)
    epoch_num = args.epochs
    val_interval = 1

    #train model
    best_metric = -1
    best_metric_epoch = -1
    epoch_loss_values = list()
    metric_values = list()
    for epoch in range(epoch_num):
        logger.info('-' * 10)
        logger.info(f"epoch {epoch + 1}/{epoch_num}")
        model.train()
        epoch_loss = 0
        step = 0
        for batch_data in train_loader:
            step += 1
            inputs, labels = batch_data[0].to(device), batch_data[1].to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = loss_function(outputs, labels)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
            logger.info(f"{step}/{len(train_loader.dataset) // train_loader.batch_size}, train_loss: {loss.item():.4f}")
            epoch_len = len(train_loader.dataset) // train_loader.batch_size        
        epoch_loss /= step
        epoch_loss_values.append(epoch_loss)
        logger.info(f"epoch {epoch + 1} average loss: {epoch_loss:.4f}")
    save_model(model, args.model_dir)


def save_model(model, model_dir):
    logger.info("Saving the model.")
    path = os.path.join(model_dir, 'model.pth')
    # recommended way from http://pytorch.org/docs/master/notes/serialization.html
    torch.save(model.cpu().state_dict(), path)

    
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    
    # Data and model checkpoints directories
    parser.add_argument('--batch-size', type=int, default=100, metavar='N',
                        help='input batch size for training (default: 1000)')
    parser.add_argument('--test-batch-size', type=int, default=100, metavar='N',
                        help='input batch size for testing (default: 100)')
    parser.add_argument('--epochs', type=int, default=5, metavar='N',
                        help='number of epochs to train (default: 5)')
    parser.add_argument('--lr', type=float, default=0.01, metavar='LR',
                        help='learning rate (default: 0.01)')
    parser.add_argument('--momentum', type=float, default=0.5, metavar='M',
                        help='SGD momentum (default: 0.5)')
    parser.add_argument('--seed', type=int, default=1, metavar='S',
                        help='random seed (default: 1)')
    parser.add_argument('--log-interval', type=int, default=100, metavar='N',
                        help='how many batches to wait before logging training status')
    parser.add_argument('--backend', type=str, default=None,
                        help='backend for distributed training (tcp, gloo on cpu and gloo, nccl on gpu)')
    
    # Container environment
    parser.add_argument('--hosts', type=list, default=json.loads(os.environ['SM_HOSTS']))
    parser.add_argument('--current-host', type=str, default=os.environ['SM_CURRENT_HOST'])
    parser.add_argument('--model-dir', type=str, default=os.environ['SM_MODEL_DIR'])
    parser.add_argument('--data-dir', type=str, default=os.environ['SM_CHANNEL_TRAIN'])
    parser.add_argument('--num-gpus', type=int, default=os.environ['SM_NUM_GPUS'])

    train(parser.parse_args())
