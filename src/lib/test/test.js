const path = require('path');
const fse = require('fs-extra');
const {Proskomma} = require('proskomma-core');
const {PipelineHandler} = require('proskomma-json-tools');

const pipelineH = new PipelineHandler({
    proskomma: new Proskomma(),
    verbose: false
});

const perfContent = fse.readJsonSync(path.resolve(__dirname, './titus_aligned.json'));

async function doPerfStripAlignmentTest() {

  let output;
  try {
    output = await pipelineH.runPipeline(
        'stripAlignmentPipeline', {
            perf: perfContent
        }
    );
    const _alignment = {
        strippedAlignment: output.strippedAlignment,
        unalignedWords: output.unalignedWords
    }
    const perf = JSON.stringify(output.perf);
    const alignment = JSON.stringify(_alignment);
    try {
        fse.writeFileSync(path.join("./test/scribu-test-FR_LSG/", "test-perf.json"), perf);
        fse.writeFileSync(path.join("./test/scribu-test-FR_LSG/", "test-alignment.json"), alignment);
    } catch (err) {
        throw new Error(`Error from writeEntryResource: ${err.message}`);
    }
  } catch (err) {
      console.log(err);
  }
};

module.exports = doPerfStripAlignmentTest;
