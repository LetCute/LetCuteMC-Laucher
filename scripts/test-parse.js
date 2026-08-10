const { Version } = require('@xmcl/core');
async function test() {
  try {
    const v = await Version.parse('C:\\Users\\Let\\AppData\\Roaming\\.minecraft', '26.2-quilt0.30.1-beta.2');
    console.log(v.libraries[0]);
    console.log("Total libs:", v.libraries.length);
  } catch (e) { console.error(e) }
}
test();
