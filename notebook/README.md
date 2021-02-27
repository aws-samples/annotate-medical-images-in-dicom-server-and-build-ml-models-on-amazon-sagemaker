## SageMaker and MONAI using DICOM

Medical Open Network for AI [MONAI](http://monai.io) was released in April 2020 and is a PyTorch-based open-source framework for deep learning in healthcare imaging.  As stated on their website, project MONAI is an initiative “to establish an inclusive community of AI researchers for the development and exchange of best practices for AI in healthcare imaging across academia and enterprise researchers.”  MONAI features include flexible pre-processing transforms for multi-dimensional data, portable API(s) for ease of integration into existing workflows, and domain specific implementations for networks, losses, and evaluation metrics.

We will demonstrate how to integrate the MONAI framework into the [Amazon SageMaker](https://aws.amazon.com/sagemaker/) managed service and give example code of MONAI pre-processing transforms using DICOM directly that can assist image transformations.  We will also review the code to invoke MONAI neural network architectures such as Densenet for image classification and explore structure of PyTorch code to train within SageMaker.  Please also visit [Build a medical image analysis pipeline on Amazon SageMaker using the MONAI framework](https://aws.amazon.com/blogs/industries/build-a-medical-image-analysis-pipeline-on-amazon-sagemaker-using-the-monai-framework/) for additional details on how to deploy the MONAI model, pipe input data from S3, and perform batch inferences using SageMaker batch transform.


## Components

This MONAI DICOM training mplementation utilizes:

- Amazon S3 bucket for DICOM images
- Amazon Sagemaker Notebook instance ml.t2.medium with 100 GB EBS and conda_pytorch_p36 kernel
- Amazon Sagemaker Pytorch managed container
- MONAI 0.4.0


## Architecture

The DICOM predictive model uses Amazon Sagemaker architecture which includes model development within managed Jupyter Notebooks, integration with the MONAI framework by extending a SageMaker managed PyTorch container, and training on ephemeral clusters that use the DICOM dataset uploaded to S3.

## Deploy Instructions

To run the DICOM training using MONAI follow the steps below:

<ol>
<li>Create an S3 bucket in your account. 
<li>Navigate to Amazon Sagemaker in the same account to create a Jupyter Notebook instance.
<li>Under Notebook > Notebook instances select Create Notebook instance. Fill in the name (ex. dicom-training-notebook) and instance type ml.t2.medium and select volume size of 100 GB.
<li>The Notebook will need permissions to call other services including SageMaker and S3.  Choose an existing role or create a role with the AmazonSageMakerFull Access IAM role.  
<li>Create Notebook instance and once In Service, then Open Jupyter Lab.
<li>In the Jupyter Notebook, select File > New > Terminal, cd SageMaker and execute
    <br/><code>git clone git@github.com:aws-samples/annotate-medical-images-in-dicom-server-and-build-ml-models-on-amazon-sagemaker.git</code>
<li>Update the set.env file within Jupyter Notebook with the S3 location (BUCKET) and prefix/path (BUCKET_PATH).
<li>Open the Jupyter Notebook dicom_training.ipynb and Run > Run all cells to observe the DICOM training example using MONAI.
</ol>

## License

This project is licensed under the MIT-0 License.


## FAQ
Will these examples work outside of Amazon SageMaker Notebook Instances?

Although most examples utilize key Amazon SageMaker functionality such as managed training this example can be run outside of Amazon SageMaker Notebook Instances with modification (updating IAM role definition and installing the necessary libraries).