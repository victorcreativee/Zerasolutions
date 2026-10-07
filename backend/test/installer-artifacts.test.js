import test from 'node:test';
import assert from 'node:assert/strict';
import {configurationDigest,publicBuild} from '../src/utils/installerArtifacts.js';
test('configuration fingerprint ignores export time and build filename but detects settings changes', () => {
  const manifest = {generatedAt:'today',deploymentSlug:'shop',business:{id:'1',name:'Shop'},modules:[{key:'POS',active:true},{key:'INVENTORY',active:false}]};
  assert.equal(configurationDigest(manifest),configurationDigest({...manifest,generatedAt:'tomorrow',deploymentSlug:'build-2',modules:[...manifest.modules].reverse()}));
  assert.notEqual(configurationDigest(manifest),configurationDigest({...manifest,business:{...manifest.business,id:'2'}}));
  assert.notEqual(configurationDigest(manifest),configurationDigest({...manifest,modules:[{key:'POS',active:false}]}));
});
test('public build history never exposes embedded configuration and does not infer signatures', () => {
  const result = publicBuild({id:'build',manifest:{private:'value'},configHash:'old',appVersion:'1'},'new','1');
  assert.equal(result.outdated,true);
  assert.equal(result.manifest,undefined);
  assert.equal(result.verification.readyForDirectCustomerOpen,false);
});
