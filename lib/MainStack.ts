import { Stack, StackProps } from 'aws-cdk-lib';
import IncidentPlan from './IncidentPlan';
import MainApi from "./RestApi";
import MainApiWaf from "./RestApiWaf";
import Synthetics from "./Synthetics";
import FrontEnd from "./FrontEnd";
import StackRollbackTrigger from './StackRollbackTrigger';
import { Construct } from "constructs";

export class DemosCdkApiPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const mainApi = new MainApi(this, "MainAPI");

    new MainApiWaf(this, "MainApiWaf", {
      ApiGateway: mainApi.ApiGateway,
    });

    const synthetics = new Synthetics(this, "WafSynthetics", {
      ApiGateway: mainApi.ApiGateway,
    });

    new FrontEnd(this, "FrontEnd", {
      ApiGateway: mainApi.ApiGateway,
    });

    new IncidentPlan(this, "IncidentPlan", {
      SyntheticFailureAlarm: synthetics.CanaryFailingAlarm,
    });

    // new StackRollbackTrigger(this, "RollbackTrigger", {
    //   Alarms: [
    //     synthetics.CanaryFailingAlarm,
    //   ],
    // });
  }
}
