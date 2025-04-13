#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";
import { MartifyCommonAssetsCodePipelineStackDev } from "../stack/martify-common-assets-code-pipeline-stack-dev";
import { MartifyCommonAssetsCodePipelineStackProd } from "../stack/martify-common-assets-code-pipeline-stack-prod";
import { MartifyCommonAssetsStackDev } from "../stack/martify-common-assets-stack-dev";
import { MartifyCommonAssetsStackProd } from "../stack/martify-common-assets-stack-prod";


const app = new App();

Tags.of(app).add("X:REPO", "martify-common-assets");

new MartifyCommonAssetsCodePipelineStackDev(app, "MartifyCommonAssetsCodePipelineStackDev", {
  env: {
    account: "886436955552",
    region: "ap-south-1",
  },
});

new MartifyCommonAssetsCodePipelineStackProd(app, "MartifyCommonAssetsCodePipelineStackProd", {
  env: {
    account: "891612578284",
    region: "ap-south-1",
  },
});

new MartifyCommonAssetsStackDev(app, "MartifyCommonAssetsStackDev", {
  env: {
    account: "886436955552",
    region: "ap-south-1",
  },
});

new MartifyCommonAssetsStackProd(app, "MartifyCommonAssetsStackProd", {
  env: {
    account: "891612578284",
    region: "ap-south-1",
  },
});
