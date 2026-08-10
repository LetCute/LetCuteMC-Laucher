const { Version } = require('@xmcl/core');
async function test() {
  try {
    const v = await Version.parse('C:\\Users\\Let\\AppData\\Roaming\\.minecraft', '26.2-quilt0.30.1-beta.2');
    console.log("Client ID:", v.client);
    console.log("Downloads:", Object.keys(v.downloads || {}));
    console.log("Asset Index:", v.assetIndex);
    console.log("Libraries count:", v.libraries.length);
  } catch (e) { console.error(e) }
}
test();
