import esbuild from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");

async function copyPluginArtifacts() {
  await mkdir("output", { recursive: true });
  await Promise.all([
    copyFile("manifest.json", "output/manifest.json"),
    copyFile("styles.css", "output/styles.css")
  ]);
}

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "cjs",
  target: "es2020",
  platform: "browser",
  sourcemap: watch ? "inline" : false,
  outfile: "output/main.js",
  external: ["obsidian"],
  plugins: [
    {
      name: "copy-obsidian-assets",
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length > 0) {
            return;
          }
          await copyPluginArtifacts();
        });
      }
    }
  ]
});

if (watch) {
  await context.watch();
  console.log("Watching for changes...");
} else {
  await context.rebuild();
  await copyPluginArtifacts();
  await context.dispose();
  console.log("Build completed.");
}
