const { getFabricLoaders, getFabricGames, installFabric, getForgeVersionList, getNeoForgedVersionList } = require('@xmcl/installer');
const path = require('path');

async function test() {
  console.log('Fetching Fabric...');
  try {
    const loaders = await getFabricLoaders();
    console.log('Fabric Loaders count:', loaders.length);
    console.log('First fabric loader:', loaders[0]);
    
    // Test install (dry run equivalent)
    const mcDir = path.resolve('./temp-mc');
    console.log('Would install to', mcDir);
    // Actually installing might download things, let's just fetch lists.
    
    console.log('\nFetching Forge...');
    const forge = await getForgeVersionList();
    console.log('Forge count:', forge.versions.length);
    console.log('First forge version:', forge.versions[0]);
  } catch(e) {
    console.error(e);
  }
}
test();
