
## Orthanc on AWS 

Here is the architecture diagram of Orthanc on AWS by default ![diagram](Figures/orthanc-on-aws.jpg) 

The single container instance and single DB instance have been tested well with Amazon SageMaker GroundTruth labeling job. 

Go to nginx-orthanc-plugins-container folder. If you want to push the container image to [Amazon Elastic Container Registry](https://aws.amazon.com/ecr/), run the following script: `./build_and_push.sh`. 

Alternatively, you can build docker container `docker build -t <tag> .` and push it to container repository manually. 

After pushing the container image to ECR, copy the image URI (like <AWS Account ID>.dkr.ecr.<AWS Region>.amazonaws.com/nginx-orthanc-plugins]) that will be used in the following Cloudformation deployment.

You can deploy the High Availability (HA) version of this stack:  
![diagramha](Figures/orthanc-on-aws-ha.jpg) 
