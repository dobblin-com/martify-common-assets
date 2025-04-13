# mdm-infra

## Stacks
* MartifyCommonAssetsCodePipelineStackDev
* MartifyCommonAssetsStackDev (Depends on MartifyCommonAssetsCodePipelineStackDev)
* MartifyCommonAssetsCodePipelineStackProd
* MartifyCommonAssetsStackProd (Depends on MartifyCommonAssetsCodePipelineStackProd)

## Useful commands

- `npm run cdk -- diff ${StackName}`      displays the diffrence in current infra with new infra
- `npm run cdk -- synth ${StackName}`     emits the synthesized CloudFormation template
- `npm run cdk -- deploy ${StackName}`    deploy this stack to your default AWS account/region