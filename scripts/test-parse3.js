const { Version } = require('@xmcl/core');
async function test() {
  try {
    const v = await Version.parse('C:\\Users\\Let\\AppData\\Roaming\\.minecraft', '26.2-quilt0.30.1-beta.2');
    let missingDownload = 0;
    for (const lib of v.libraries) {
      if (!lib.download) {
        missingDownload++;
        console.log("No download:", lib.name);
      }
    }
    console.log("Total libs:", v.libraries.length, "Missing download:", missingDownload);
  } catch (e) { console.error(e) }
}
test();
