import { Path } from 'src/lib/ericchase/Platform/Node/Path.js';
import { ConsoleError, ConsoleLog } from 'src/lib/ericchase/Utility/Console.js';
import { DefaultBuilder, ProcessorModule } from 'tools/lib/Builder.js';
import { ProjectFile } from 'tools/lib/ProjectFile.js';

const transpiler = new Bun.Transpiler({
  loader: 'tsx',
});

type BuildConfig = Pick<Parameters<typeof Bun.build>[0], 'external' | 'sourcemap' | 'target'>;

export class Processor_TypeScriptGenericBundler implements ProcessorModule {
  builder = DefaultBuilder;

  config: Parameters<typeof Bun.build>[0];

  constructor({ external = [], sourcemap = 'linked', target = 'browser' }: BuildConfig, tempdir = 'tmp') {
    this.config = {
      entrypoints: [],
      external: ['*.module.js', ...(external ?? [])],
      format: 'esm',
      minify: {
        identifiers: false,
        syntax: false,
        whitespace: false,
      },
      sourcemap: sourcemap ?? 'none',
      target: target ?? 'browser',
    };
  }

  async onFilesAdded(file_list: ProjectFile[]) {
    for (const file of file_list) {
      // only bundle .module.ts files
      if (file.src_file.path.endsWith('.module.ts')) {
        file.out_file = file.out_file.newExt('.js');
        file.processor_function_list.push(async (file) => {
          await this.scanImports(file);
          this.config.entrypoints = [file.src_file.path];
          const result = await Bun.build(this.config);
          if (result.success === true) {
            for (const artifact of result.outputs) {
              switch (artifact.kind) {
                case 'entry-point':
                  file.setText(await artifact.text());
                  break;
                case 'sourcemap':
                  await Bun.write(file.out_file.newBase(new Path(artifact.path).base).path, await artifact.text());
                  break;
              }
            }
          } else {
            ConsoleError('Error:\n', file.src_file.path);
            for (const log of result.logs) {
              ConsoleLog(log.message);
            }
            ConsoleLog();
          }
        });
        continue;
      }

      // scan other typescript files for dependency map
      if (file.src_file.path.endsWith('.ts')) {
        file.processor_function_list.push(async (file) => {
          await this.scanImports(file);
        });
      }
    }
  }

  async scanImports(file: ProjectFile) {
    // console.log('scanning', file.src_file.standard_path);
    // const { imports } = transpiler.scan(await file.getText());
    // for (const { path } of imports) {
    //   console.log(' ', path);
    // }
  }
}
