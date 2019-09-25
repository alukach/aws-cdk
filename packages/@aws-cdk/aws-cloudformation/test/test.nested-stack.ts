import { expect, haveResource, SynthUtils } from '@aws-cdk/assert';
import ecr_assets = require('@aws-cdk/aws-ecr-assets');
import s3_assets = require('@aws-cdk/aws-s3-assets');
import { App, CfnParameter, CfnResource, Construct, Stack } from '@aws-cdk/core';
import fs = require('fs');
import { Test } from 'nodeunit';
import path = require('path');
import { NestedStack } from '../lib/nested-stack';

// tslint:disable:max-line-length

export = {
  'fails if defined as a root'(test: Test) {
    // THEN
    test.throws(() => new NestedStack(undefined as any, 'boom'), /Nested stacks cannot be defined as a root construct/);
    test.done();
  },

  'fails if defined without a parent stack'(test: Test) {
    // GIVEN
    const app = new App();
    const group = new Construct(app, 'group');

    // THEN
    test.throws(() => new NestedStack(app, 'boom'), /must be defined within scope of another non-nested stack/);
    test.throws(() => new NestedStack(group, 'bam'), /must be defined within scope of another non-nested stack/);
    test.done();
  },

  'can be defined as a direct child or an indirect child of a Stack'(test: Test) {
    // GIVEN
    const parent = new Stack();

    // THEN
    new NestedStack(parent, 'direct');
    new NestedStack(new Construct(parent, 'group'), 'indirect');
    test.done();
  },

  'nested stack is not synthesized as a stack artifact into the assembly'(test: Test) {
    // GIVEN
    const app = new App();
    const parentStack = new Stack(app, 'parent-stack');
    new NestedStack(parentStack, 'nested-stack');

    // WHEN
    const assembly = app.synth();

    // THEN
    test.deepEqual(assembly.artifacts.length, 1);
    test.done();
  },

  'the template of the nested stack is synthesized into the cloud assembly'(test: Test) {
    // GIVEN
    const app = new App();
    const parent = new Stack(app, 'parent-stack');
    const nested = new NestedStack(parent, 'nested-stack');
    new CfnResource(nested, 'ResourceInNestedStack', { type: 'AWS::Resource::Nested' });

    // WHEN
    const assembly = app.synth();

    // THEN
    const template = JSON.parse(fs.readFileSync(path.join(assembly.directory, `${nested.node.uniqueId}.nested.template.json`), 'utf-8'));
    test.deepEqual(template, {
      Resources: {
        ResourceInNestedStack: {
          Type: 'AWS::Resource::Nested'
        }
      }
    });
    test.done();
  },

  'file asset metadata is associated with the parent stack'(test: Test) {
    // GIVEN
    const app = new App();
    const parent = new Stack(app, 'parent-stack');
    const nested = new NestedStack(parent, 'nested-stack');
    new CfnResource(nested, 'ResourceInNestedStack', { type: 'AWS::Resource::Nested' });

    // WHEN
    const assembly = app.synth();

    // THEN
    test.deepEqual(assembly.getStack(parent.stackName).assets, [{
      path: 'parentstacknestedstack844892C0.nested.template.json',
      id: 'c639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096',
      packaging: 'file',
      sourceHash: 'c639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096',
      s3BucketParameter: 'AssetParametersc639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096S3BucketDA8C3345',
      s3KeyParameter: 'AssetParametersc639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096S3VersionKey09D03EE6',
      artifactHashParameter: 'AssetParametersc639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096ArtifactHash8DE450C7'
    }]);
    test.done();
  },

  'aws::cloudformation::stack is synthesized in the parent scope'(test: Test) {
    // GIVEN
    const app = new App();
    const parent = new Stack(app, 'parent-stack');

    // WHEN
    const nested = new NestedStack(parent, 'nested-stack');
    new CfnResource(nested, 'ResourceInNestedStack', { type: 'AWS::Resource::Nested' });

    // THEN
    const assembly = app.synth();

    // assembly has one stack (the parent)
    test.deepEqual(assembly.stacks.length, 1);

    // but this stack has an asset that points to the synthesized template
    test.deepEqual(assembly.stacks[0].assets[0].path, 'parentstacknestedstack844892C0.nested.template.json');

    // the template includes our resource
    const filePath = path.join(assembly.directory, assembly.stacks[0].assets[0].path);
    test.deepEqual(JSON.parse(fs.readFileSync(filePath).toString('utf-8')), {
      Resources: { ResourceInNestedStack: { Type: 'AWS::Resource::Nested' } }
    });

    // the parent template includes the parameters and the nested stack resource which points to the s3 url
    expect(parent).toMatch({
      Resources: {
        nestedstackNestedStacknestedstackNestedStackResource71CDD241: {
          Type: "AWS::CloudFormation::Stack",
          Properties: {
            TemplateURL: {
              "Fn::Join": [
                "",
                [
                  "https://s3.",
                  {
                    Ref: "AWS::Region"
                  },
                  ".",
                  {
                    Ref: "AWS::URLSuffix"
                  },
                  "/",
                  {
                    Ref: "AssetParametersc639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096S3BucketDA8C3345"
                  },
                  "/",
                  {
                    "Fn::Select": [
                      0,
                      {
                        "Fn::Split": [
                          "||",
                          {
                            Ref: "AssetParametersc639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096S3VersionKey09D03EE6"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "Fn::Select": [
                      1,
                      {
                        "Fn::Split": [
                          "||",
                          {
                            Ref: "AssetParametersc639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096S3VersionKey09D03EE6"
                          }
                        ]
                      }
                    ]
                  }
                ]
              ]
            }
          }
        }
      },
      Parameters: {
        AssetParametersc639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096S3BucketDA8C3345: {
          Type: "String",
          Description: "S3 bucket for asset \"c639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096\""
        },
        AssetParametersc639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096S3VersionKey09D03EE6: {
          Type: "String",
          Description: "S3 key for asset version \"c639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096\""
        },
        AssetParametersc639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096ArtifactHash8DE450C7: {
          Type: "String",
          Description: "Artifact hash for asset \"c639c0a5e7320758aa22589669ecebc98f185b711300b074f53998c8f9a45096\""
        }
      }
    });
    test.done();
  },

  'Stack.of()'(test: Test) {
    class MyNestedStack extends NestedStack {
      public readonly stackOfChild: Stack;

      constructor(scope: Construct, id: string) {
        super(scope, id);

        const param = new CfnParameter(this, 'param', { type: 'String' });
        this.stackOfChild = Stack.of(param);
      }
    }

    const parent = new Stack();
    const nested = new MyNestedStack(parent, 'nested');

    test.ok(nested.stackOfChild === nested);
    test.ok(Stack.of(nested) === nested);
    test.done();
  },

  'references within the nested stack are not reported as cross stack references'(test: Test) {
    class MyNestedStack extends NestedStack {
      constructor(scope: Construct, id: string) {
        super(scope, id);

        const param = new CfnParameter(this, 'param', { type: 'String' });
        new CfnResource(this, 'resource', {
          type: 'My::Resource',
          properties: {
            SomeProp: param.valueAsString
          }
        });
      }
    }

    const app = new App();
    const parent = new Stack(app, 'parent');

    new MyNestedStack(parent, 'nested');

    // references are added during "prepare"
    const assembly = app.synth();

    test.deepEqual(assembly.stacks.length, 1);
    test.deepEqual(assembly.stacks[0].dependencies, []);
    test.done();
  },

  'references to a resource from the parent stack in a nested stack is translated into a cfn parameter'(test: Test) {
    // WHEN
    class MyNestedStack extends NestedStack {

      constructor(scope: Construct, id: string, resourceFromParent: CfnResource) {
        super(scope, id);

        new CfnResource(this, 'resource', {
          type: 'AWS::Child::Resource',
          properties: {
            ReferenceToResourceInParentStack: resourceFromParent.ref
          }
        });

        new CfnResource(this, 'resource2', {
          type: 'My::Resource::2',
          properties: {
            Prop1: resourceFromParent.getAtt('Attr'),
            Prop2: resourceFromParent.ref,
          }
        });
      }
    }

    const app = new App();
    const parentStack = new Stack(app, 'parent');

    const resource = new CfnResource(parentStack, 'parent-resource', { type: 'AWS::Parent::Resource' });

    const nested = new MyNestedStack(parentStack, 'nested', resource);

    // THEN
    app.synth();

    // nested template should use a parameter to reference the resource from the parent stack
    expect(nested).toMatch({
      Resources:
      {
        resource:
        {
          Type: 'AWS::Child::Resource',
          Properties:
            { ReferenceToResourceInParentStack: { Ref: 'referencetoparentparentresourceD56EA8F7Ref' } }
        },
        resource2:
        {
          Type: 'My::Resource::2',
          Properties:
          {
            Prop1: { Ref: 'referencetoparentparentresourceD56EA8F7Attr' },
            Prop2: { Ref: 'referencetoparentparentresourceD56EA8F7Ref' }
          }
        }
      },
      Parameters:
      {
        referencetoparentparentresourceD56EA8F7Ref: { Type: 'String' },
        referencetoparentparentresourceD56EA8F7Attr: { Type: 'String' }
      }
    });

    // parent template should pass in the value through the parameter
    expect(parentStack).to(haveResource('AWS::CloudFormation::Stack', {
      Parameters: {
        referencetoparentparentresourceD56EA8F7Ref: {
          Ref: "parentresource"
        },
        referencetoparentparentresourceD56EA8F7Attr: {
          "Fn::GetAtt": [
            "parentresource",
            "Attr"
          ]
        }
      },
    }));

    test.done();
  },

  'references to a resource in the nested stack in the parent is translated into a cfn output'(test: Test) {
    class MyNestedStack extends NestedStack {
      public readonly resourceFromChild: CfnResource;

      constructor(scope: Construct, id: string) {
        super(scope, id);

        this.resourceFromChild = new CfnResource(this, 'resource', {
          type: 'AWS::Child::Resource',
        });
      }
    }

    const app = new App();
    const parentStack = new Stack(app, 'parent');

    const nested = new MyNestedStack(parentStack, 'nested');

    new CfnResource(parentStack, 'another-parent-resource', {
      type: 'AWS::Parent::Resource',
      properties: {
        RefToResourceInNestedStack: nested.resourceFromChild.ref
      }
    });

    // references are added during "prepare"
    app.synth();

    // nested template should use a parameter to reference the resource from the parent stack
    expect(nested).toMatch({
      Resources: {
        resource: { Type: 'AWS::Child::Resource' }
      },
      Outputs: {
        parentnestedresource4D680677Ref: { Value: { Ref: 'resource' } }
      }
    });

    // parent template should pass in the value through the parameter
    expect(parentStack).to(haveResource('AWS::Parent::Resource', {
      RefToResourceInNestedStack: {
        "Fn::GetAtt": [
          "nestedNestedStacknestedNestedStackResource3DD143BF",
          "Outputs.parentnestedresource4D680677Ref"
        ]
      }
    }));

    test.done();
  },

  'nested stack references a resource from another non-nested stack (not the parent)'(test: Test) {
    // GIVEN
    const app = new App();
    const stack1 = new Stack(app, 'Stack1');
    const stack2 = new Stack(app, 'Stack2');
    const nestedUnderStack1 = new NestedStack(stack1, 'NestedUnderStack1');
    const resourceInStack2 = new CfnResource(stack2, 'ResourceInStack2', { type: 'MyResource' });

    // WHEN
    new CfnResource(nestedUnderStack1, 'ResourceInNestedStack1', {
      type: 'Nested::Resource',
      properties: {
        RefToSibling: resourceInStack2.getAtt('MyAttribute')
      }
    });

    // THEN
    const assembly = app.synth();

    // producing stack should have an export
    expect(stack2).toMatch({
      Resources: {
        ResourceInStack2: { Type: "MyResource" }
      },
      Outputs: {
        ExportsOutputFnGetAttResourceInStack2MyAttributeC15F1009: {
          Value: { "Fn::GetAtt": ["ResourceInStack2", "MyAttribute"] },
          Export: { Name: "Stack2:ExportsOutputFnGetAttResourceInStack2MyAttributeC15F1009" }
        }
      }
    });

    // nested stack uses Fn::ImportValue like normal
    expect(nestedUnderStack1).toMatch({
      Resources: {
        ResourceInNestedStack1: {
          Type: "Nested::Resource",
          Properties: {
            RefToSibling: {
              "Fn::ImportValue": "Stack2:ExportsOutputFnGetAttResourceInStack2MyAttributeC15F1009"
            }
          }
        }
      }
    });

    // verify a depedency was established between the parents
    const stack1Artifact = assembly.getStack(stack1.stackName);
    const stack2Artifact = assembly.getStack(stack2.stackName);
    test.deepEqual(stack1Artifact.dependencies.length, 1);
    test.deepEqual(stack2Artifact.dependencies.length, 0);
    test.same(stack1Artifact.dependencies[0], stack2Artifact);
    test.done();
  },

  'another non-nested stack takes a reference on a resource within the nested stack (the parent exports)'(test: Test) {
    // GIVEN
    const app = new App();
    const stack1 = new Stack(app, 'Stack1');
    const stack2 = new Stack(app, 'Stack2');
    const nestedUnderStack1 = new NestedStack(stack1, 'NestedUnderStack1');
    const resourceInNestedStack = new CfnResource(nestedUnderStack1, 'ResourceInNestedStack', { type: 'MyResource' });

    // WHEN
    new CfnResource(stack2, 'ResourceInStack2', {
      type: 'JustResource',
      properties: {
        RefToSibling: resourceInNestedStack.getAtt('MyAttribute')
      }
    });

    // THEN
    const assembly = app.synth();

    // nested stack should output this value as if it was referenced by the parent (without the export)
    expect(nestedUnderStack1).toMatch({
      Resources: {
        ResourceInNestedStack: {
          Type: "MyResource"
        }
      },
      Outputs: {
        Stack1NestedUnderStack1ResourceInNestedStack6EE9DCD2MyAttribute: {
          Value: {
            "Fn::GetAtt": [
              "ResourceInNestedStack",
              "MyAttribute"
            ]
          }
        }
      }
    });

    // parent stack (stack1) should export this value
    test.deepEqual(assembly.getStack(stack1.stackName).template.Outputs, {
      ExportsOutputFnGetAttNestedUnderStack1NestedStackNestedUnderStack1NestedStackResourceF616305BOutputsStack1NestedUnderStack1ResourceInNestedStack6EE9DCD2MyAttribute564EECF3: {
        Value: { 'Fn::GetAtt': ['NestedUnderStack1NestedStackNestedUnderStack1NestedStackResourceF616305B', 'Outputs.Stack1NestedUnderStack1ResourceInNestedStack6EE9DCD2MyAttribute'] },
        Export: { Name: 'Stack1:ExportsOutputFnGetAttNestedUnderStack1NestedStackNestedUnderStack1NestedStackResourceF616305BOutputsStack1NestedUnderStack1ResourceInNestedStack6EE9DCD2MyAttribute564EECF3' }
      }
    });

    // consuming stack should use ImportValue to import the value from the parent stack
    expect(stack2).toMatch({
      Resources: {
        ResourceInStack2: {
          Type: "JustResource",
          Properties: {
            RefToSibling: {
              "Fn::ImportValue": "Stack1:ExportsOutputFnGetAttNestedUnderStack1NestedStackNestedUnderStack1NestedStackResourceF616305BOutputsStack1NestedUnderStack1ResourceInNestedStack6EE9DCD2MyAttribute564EECF3"
            }
          }
        }
      }
    });

    test.deepEqual(assembly.stacks.length, 2);
    const stack1Artifact = assembly.getStack(stack1.stackName);
    const stack2Artifact = assembly.getStack(stack2.stackName);
    test.deepEqual(stack1Artifact.dependencies.length, 0);
    test.deepEqual(stack2Artifact.dependencies.length, 1);
    test.same(stack2Artifact.dependencies[0], stack1Artifact);
    test.done();
  },

  'references between sibling nested stacks should output from one and getAtt from the other'(test: Test) {
    // GIVEN
    const app = new App();
    const parent = new Stack(app, 'Parent');
    const nested1 = new NestedStack(parent, 'Nested1');
    const nested2 = new NestedStack(parent, 'Nested2');
    const resource1 = new CfnResource(nested1, 'Resource1', { type: 'Resource1' });

    // WHEN
    new CfnResource(nested2, 'Resource2', {
      type: 'Resource2',
      properties: {
        RefToResource1: resource1.ref
      }
    });

    // THEN
    app.synth();

    // producing nested stack
    expect(nested1).toMatch({
      Resources: {
        Resource1: {
          Type: "Resource1"
        }
      },
      Outputs: {
        ParentNested1Resource15F3F0657Ref: {
          Value: {
            Ref: "Resource1"
          }
        }
      }
    });

    // consuming nested stack
    expect(nested2).toMatch({
      Resources: {
        Resource2: {
          Type: "Resource2",
          Properties: {
            RefToResource1: {
              Ref: "referencetoParentNested1NestedStackNested1NestedStackResource9C05342COutputsParentNested1Resource15F3F0657Ref"
            }
          }
        }
      },
      Parameters: {
        referencetoParentNested1NestedStackNested1NestedStackResource9C05342COutputsParentNested1Resource15F3F0657Ref: {
          Type: "String"
        }
      }
    });

    // parent
    expect(parent).to(haveResource('AWS::CloudFormation::Stack', {
      Parameters: {
        referencetoParentNested1NestedStackNested1NestedStackResource9C05342COutputsParentNested1Resource15F3F0657Ref: {
          "Fn::GetAtt": [
            "Nested1NestedStackNested1NestedStackResourceCD0AD36B",
            "Outputs.ParentNested1Resource15F3F0657Ref"
          ]
        }
      }
    }));

    test.done();
  },

  'stackId returns AWS::StackId when referenced from the context of the nested stack'(test: Test) {
    // GIVEN
    const parent = new Stack();
    const nested = new NestedStack(parent, 'NestedStack');

    // WHEN
    new CfnResource(nested, 'NestedResource', {
      type: 'Nested::Resource',
      properties: { MyStackId: nested.stackId }
    });

    // THEN
    expect(nested).to(haveResource('Nested::Resource', {
      MyStackId: { Ref: "AWS::StackId" }
    }));

    test.done();
  },

  'stackId returns the REF of the CloudFormation::Stack resource when referenced from the parent stack'(test: Test) {
    // GIVEN
    const parent = new Stack();
    const nested = new NestedStack(parent, 'NestedStack');

    // WHEN
    new CfnResource(parent, 'ParentResource', {
      type: 'Parent::Resource',
      properties: { NestedStackId: nested.stackId }
    });

    // THEN
    expect(parent).to(haveResource('Parent::Resource', {
      NestedStackId: { Ref: "NestedStackNestedStackNestedStackNestedStackResourceB70834FD" }
    }));

    test.done();
  },

  'stackName returns AWS::StackName when referenced from the context of the nested stack'(test: Test) {
    // GIVEN
    const parent = new Stack();
    const nested = new NestedStack(parent, 'NestedStack');

    // WHEN
    new CfnResource(nested, 'NestedResource', {
      type: 'Nested::Resource',
      properties: { MyStackName: nested.stackName }
    });

    // THEN
    expect(nested).to(haveResource('Nested::Resource', {
      MyStackName: { Ref: "AWS::StackName" }
    }));

    test.done();
  },

  'stackName returns the REF of the CloudFormation::Stack resource when referenced from the parent stack'(test: Test) {
    // GIVEN
    const parent = new Stack();
    const nested = new NestedStack(parent, 'NestedStack');

    // WHEN
    new CfnResource(parent, 'ParentResource', {
      type: 'Parent::Resource',
      properties: { NestedStackName: nested.stackName }
    });

    // THEN
    expect(parent).to(haveResource('Parent::Resource', {
      NestedStackName: {
        "Fn::Select": [
          1,
          {
            "Fn::Split": [
              "/",
              {
                Ref: "NestedStackNestedStackNestedStackNestedStackResourceB70834FD"
              }
            ]
          }
        ]
      }
    }));

    test.done();
  },

  '"account", "region" and "environment" are all derived from the parent'(test: Test) {
    // GIVEN
    const app = new App();
    const parent = new Stack(app, 'ParentStack', { env: { account: '1234account', region: 'us-east-44' } });

    // WHEN
    const nested = new NestedStack(parent, 'NestedStack');

    // THEN
    test.deepEqual(nested.environment, parent.environment);
    test.deepEqual(nested.account, parent.account);
    test.deepEqual(nested.region, parent.region);
    test.done();
  },

  'double-nested stack'(test: Test) {
    // GIVEN
    const app = new App();
    const parent = new Stack(app, 'stack');

    // WHEN
    const nested1 = new NestedStack(parent, 'Nested1');
    const nested2 = new NestedStack(nested1, 'Nested2');

    new CfnResource(nested1, 'Resource1', { type: 'Resource::1' });
    new CfnResource(nested2, 'Resource2', { type: 'Resource::2' });

    // THEN
    const assembly = app.synth();

    // nested2 is a "leaf", so it's just the resource
    expect(nested2).toMatch({
      Resources: {
        Resource2: { Type: "Resource::2" }
      }
    });

    // nested1 wires the nested2 template through parameters, so we expect those
    expect(nested1).to(haveResource('Resource::1'));
    const nested2Template = SynthUtils.toCloudFormation(nested1);
    test.deepEqual(nested2Template.Parameters, {
      referencetostackAssetParameters8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235cS3BucketE8768F5CRef: { Type: 'String' },
      referencetostackAssetParameters8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235cS3VersionKey49DD83A2Ref: { Type: 'String' },
    });

    // parent stack should have two sets of parameters. one for the first nested stack and the second
    // for the second nested stack, passed in as parameters to the first
    const template = SynthUtils.toCloudFormation(parent);
    test.deepEqual(template.Parameters, {
      AssetParameters8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235cS3BucketDE3B88D6: { Type: 'String', Description: 'S3 bucket for asset "8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235c"' },
      AssetParameters8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235cS3VersionKey3A62EFEA: { Type: 'String', Description: 'S3 key for asset version "8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235c"' },
      AssetParameters8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235cArtifactHash7DC546E0: { Type: 'String', Description: 'Artifact hash for asset "8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235c"' },
      AssetParameters8b50795a950cca6b01352f162c45d9d274dee6bc409f2f2b2ed029ad6828b3bfS3Bucket76ACFB38: { Type: 'String', Description: 'S3 bucket for asset "8b50795a950cca6b01352f162c45d9d274dee6bc409f2f2b2ed029ad6828b3bf"' },
      AssetParameters8b50795a950cca6b01352f162c45d9d274dee6bc409f2f2b2ed029ad6828b3bfS3VersionKey04162EF1: { Type: 'String', Description: 'S3 key for asset version "8b50795a950cca6b01352f162c45d9d274dee6bc409f2f2b2ed029ad6828b3bf"' },
      AssetParameters8b50795a950cca6b01352f162c45d9d274dee6bc409f2f2b2ed029ad6828b3bfArtifactHashF227ADD3: { Type: 'String', Description: 'Artifact hash for asset "8b50795a950cca6b01352f162c45d9d274dee6bc409f2f2b2ed029ad6828b3bf"' }
    });

    // proxy asset params to nested stack
    expect(parent).to(haveResource('AWS::CloudFormation::Stack', {
      Parameters: {
        referencetostackAssetParameters8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235cS3BucketE8768F5CRef: { Ref: "AssetParameters8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235cS3BucketDE3B88D6" },
        referencetostackAssetParameters8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235cS3VersionKey49DD83A2Ref: { Ref: "AssetParameters8169c6f8aaeaf5e2e8620f5f895ffe2099202ccb4b6889df48fe0967a894235cS3VersionKey3A62EFEA" }
      }
    }));

    // parent stack should have 2 assets
    test.deepEqual(assembly.getStack(parent.stackName).assets.length, 2);
    test.done();
  },

  'assets within nested stacks are proxied from the parent'(test: Test) {
    // GIVEN
    const app = new App();
    const parent = new Stack(app, 'ParentStack');
    const nested = new NestedStack(parent, 'NestedStack');

    // WHEN
    const asset = new s3_assets.Asset(nested, 'asset', {
      path: path.join(__dirname, 'asset-fixture.txt')
    });

    new CfnResource(nested, 'NestedResource', {
      type: 'Nested::Resource',
      properties: {
        AssetBucket: asset.s3BucketName,
        AssetKey: asset.s3ObjectKey
      }
    });

    // THEN
    const assembly = app.synth();
    const template = SynthUtils.toCloudFormation(parent);

    // two sets of asset parameters: one for the nested stack itself and one as a proxy for the asset within the stack
    test.deepEqual(template.Parameters, {
      AssetParametersdb01ee2eb7adc7915e364dc410d861e569543f9be3761d535a68d5c2cc181281S3BucketC188F637: { Type: 'String', Description: 'S3 bucket for asset "db01ee2eb7adc7915e364dc410d861e569543f9be3761d535a68d5c2cc181281"' },
      AssetParametersdb01ee2eb7adc7915e364dc410d861e569543f9be3761d535a68d5c2cc181281S3VersionKeyC7F4DBF2: { Type: 'String', Description: 'S3 key for asset version "db01ee2eb7adc7915e364dc410d861e569543f9be3761d535a68d5c2cc181281"' },
      AssetParametersdb01ee2eb7adc7915e364dc410d861e569543f9be3761d535a68d5c2cc181281ArtifactHash373B14D2: { Type: 'String', Description: 'Artifact hash for asset "db01ee2eb7adc7915e364dc410d861e569543f9be3761d535a68d5c2cc181281"' },
      AssetParameters46b107d6db798ca46046b8669d057a4debcbdbaaddb6170400748c2f9e4f9d71S3Bucket3C4265E9: { Type: 'String', Description: 'S3 bucket for asset "46b107d6db798ca46046b8669d057a4debcbdbaaddb6170400748c2f9e4f9d71"' },
      AssetParameters46b107d6db798ca46046b8669d057a4debcbdbaaddb6170400748c2f9e4f9d71S3VersionKey8E981535: { Type: 'String', Description: 'S3 key for asset version "46b107d6db798ca46046b8669d057a4debcbdbaaddb6170400748c2f9e4f9d71"' },
      AssetParameters46b107d6db798ca46046b8669d057a4debcbdbaaddb6170400748c2f9e4f9d71ArtifactHash45A28583: { Type: 'String', Description: 'Artifact hash for asset "46b107d6db798ca46046b8669d057a4debcbdbaaddb6170400748c2f9e4f9d71"' }
    });

    // asset proxy parameters are passed to the nested stack
    expect(parent).to(haveResource('AWS::CloudFormation::Stack', {
      Parameters: {
        referencetoParentStackAssetParametersdb01ee2eb7adc7915e364dc410d861e569543f9be3761d535a68d5c2cc181281S3Bucket82C55B96Ref: { Ref: "AssetParametersdb01ee2eb7adc7915e364dc410d861e569543f9be3761d535a68d5c2cc181281S3BucketC188F637" },
        referencetoParentStackAssetParametersdb01ee2eb7adc7915e364dc410d861e569543f9be3761d535a68d5c2cc181281S3VersionKeyA43C3CC6Ref: { Ref: "AssetParametersdb01ee2eb7adc7915e364dc410d861e569543f9be3761d535a68d5c2cc181281S3VersionKeyC7F4DBF2" },
      }
    }));

    // parent stack should have 2 assets
    test.deepEqual(assembly.getStack(parent.stackName).assets.length, 2);
    test.done();
  },

  'docker image assets are wired through the top-level stack'(test: Test) {
    // GIVEN
    const app = new App();
    const parent = new Stack(app, 'my-stack');
    const nested = new NestedStack(parent, 'nested-stack');

    // WHEN
    new ecr_assets.DockerImageAsset(nested, 'docker-image', {
      directory: path.join(__dirname, 'asset-docker-fixture'),
      repositoryName: 'repoName',
      buildArgs: { key: 'value', boom: 'bam' },
      target: 'buildTarget'
    });

    // THEN
    const parentParams = SynthUtils.toCloudFormation(parent).Parameters;
    test.ok(parentParams.AssetParameters4cf7029bde90639281b09ed0333d1913c7eca2b61591e41d85a8ff3a4cf723a8ImageName27B32C1A);
    const nestedParams = SynthUtils.toCloudFormation(nested).Parameters;
    test.ok(nestedParams.referencetomystackAssetParameters4cf7029bde90639281b09ed0333d1913c7eca2b61591e41d85a8ff3a4cf723a8ImageNameED31E0D1Ref);

    expect(parent).to(haveResource('AWS::CloudFormation::Stack', {
      Parameters: {
        referencetomystackAssetParameters4cf7029bde90639281b09ed0333d1913c7eca2b61591e41d85a8ff3a4cf723a8ImageNameED31E0D1Ref: {
          Ref: "AssetParameters4cf7029bde90639281b09ed0333d1913c7eca2b61591e41d85a8ff3a4cf723a8ImageName27B32C1A"
        },
        referencetomystackAssetParametersea7034d81c091be1158bcd85b4958dc86ec6672c345be27607d68fdfcf26b1c1S3Bucket6A7166F6Ref: {
          Ref: "AssetParametersea7034d81c091be1158bcd85b4958dc86ec6672c345be27607d68fdfcf26b1c1S3BucketE797C7BB"
        },
        referencetomystackAssetParametersea7034d81c091be1158bcd85b4958dc86ec6672c345be27607d68fdfcf26b1c1S3VersionKey6B0123FCRef: {
          Ref: "AssetParametersea7034d81c091be1158bcd85b4958dc86ec6672c345be27607d68fdfcf26b1c1S3VersionKey56C3F6D7"
        }
      }
    }));

    test.done();
  }
};
