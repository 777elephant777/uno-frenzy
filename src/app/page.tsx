import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * UNO FRENZY — static site preview.
 *
 * The real game lives in the workspace root as plain static files
 * (index.html + style.css + script.js) so it can be dropped onto
 * GitHub Pages as-is. This route simply reads those exact files and
 * inlines them into the page, so the preview always shows precisely
 * what will be deployed.
 */
const readWorkspaceFile = (file: string) =>
  readFile(path.join(process.cwd(), file), "utf8");

export default async function Home() {
  const [html, css, js] = await Promise.all([
    readWorkspaceFile("index.html"),
    readWorkspaceFile("style.css"),
    readWorkspaceFile("script.js"),
  ]);

  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <script dangerouslySetInnerHTML={{ __html: js }} />
    </>
  );
}
