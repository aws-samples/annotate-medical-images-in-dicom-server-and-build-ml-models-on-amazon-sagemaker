## Annotate Medical Images in DICOM Server and Build ML models using Amazon SageMaker

## Deployment Steps

### Pre-requisite

Go to AWS Console and create a new [Cloud9 environment(https://aws.amazon.com/cloud9/). You can [configure the SSH connection to GitHub](https://docs.github.com/en/free-pro-team@latest/github/authenticating-to-github/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent) (Optional). Git clone this repository.

Configure AWS Command Line Interface (CLI) through `aws configure`

You will need two public subnets and two private subnets in a given Virtual Private Cloud (VPC). You can deploy the VPC network infrastructure using this [CloudFormation template](https://docs.aws.amazon.com/codebuild/latest/userguide/cloudformation-vpc-template.html) (Optional)

### Deploy Orthanc DICOM Server on AWS ECS

Go to nginx-orthanc-plugins-container folder. If you want to push the container image to [Amazon Elastic Container Registry](https://aws.amazon.com/ecr/), run the following script: `./build_and_push.sh`. 

Alternatively, you can build docker container `docker build -t <tag> .` and push it to container repository manually. 

After pushing the container image to ECR, copy the image URI that will be used in the following Cloudformation deployment.

You can either go to AWS Console, select Cloudformation service, deploy the template orthanc-ec2-rds-cfn-tempalte.yaml. 

Or

### Upload DICOM images to Orthanc 

Orthanc supports WADO-RS with its [RESTful API](https://book.orthanc-server.com/users/rest.html). You can upload a DICOM image from local folder:

`curl -u orthanc:orthanc -X POST https://orthanconawsloadbalancer-7f80f3d1ca7c01b4.elb.us-west-2.amazonaws.com/instances --data-binary @000046e4-e4d7f796-72c3dba4-8b67a485-0eea211d.dcm -k`

After uploaded, check the instance id assigned:
`curl -u orthanc:orthanc https://orthanconawsloadbalancer-7f80f3d1ca7c01b4.elb.us-west-2.amazonaws.com/instances/ -k`

Then put this in source field of manifest.json
`https://orthanconawsloadbalancer-7f80f3d1ca7c01b4.elb.us-west-2.amazonaws.com/instances/502b0a4b-5cb43965-7f092716-bd6fe6d6-4f7fc3ce`

### Deploy the pre and post labeling Lambda functions


### Create Custom Label Job in SageMaker GroundTruth

Copy the content in template.liquid.html file to the Custom Template text field.


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
