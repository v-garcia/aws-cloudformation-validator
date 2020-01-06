const aslValidator = require('asl-validator');
const yaml = require('js-yaml');
const { schema } = require('yaml-cfn');
const fs = require('fs');
const cfn = require('cfn');
const core = require('@actions/core');

function setTaskResourceToDefault({ States, ...rest }) {
  return {
    ...rest,
    States: Object.fromEntries(
      Object.entries(States).map(([k, v]) => [
        k,
        'Resource' in v ? { ...v, Resource: 'arn:aws:lambda:region:123:function:groupname-step-fn-api' } : v
      ])
    )
  };
}

function checkStatesMachineDefinitions(filePath) {
  const cfFile = yaml.safeLoad(fs.readFileSync(filePath, 'utf8'), { schema: schema });

  const { Resources = {} } = cfFile;

  for (const key in Resources) {
    const res = Resources[key];

    if (typeof res !== 'object' || res['Type'] !== 'AWS::StepFunctions::StateMachine') {
      continue;
    }

    let definition = res.Properties.DefinitionString;
    definition = 'Fn::Sub' in definition ? definition['Fn::Sub'] : definition;
    definition = JSON.parse(definition);
    definition = setTaskResourceToDefault(definition);

    const { isValid, errors } = aslValidator(definition);

    if (isValid) {
      console.log(`✓ State machine definition '${key}' is valid`);
    } else {
      console.error(`X State machine definition '${key}' is not valid`);
      console.error(errors);
      process.exit(1);
    }
  }
}

async function validateCloudformation(filePath) {
  try {
    await cfn.validate('eu-central-1', filePath, {});
    console.log(`✓ CloudFormation file: '${filePath}' is valid`);
  } catch (e) {
    console.error(`X CloudFormation is not valid`);
    console.error(e);
    process.exit(1);
  }
}

(async () => {
  const cloudFormationFile = core.getInput('cloudFormationPath');

  await validateCloudformation(cloudFormationFile);
  checkStatesMachineDefinitions(cloudFormationFile);
})();
