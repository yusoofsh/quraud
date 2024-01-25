import MP3Tag from "mp3tag.js";
import { createWriteStream, existsSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stdout } from "node:process";
import { pipeline } from "node:stream/promises";

const rename = async (path: string, file: string) => {
  stdout.write(`[Renaming] ${file}\r`);

  const original = await readFile(path);
  const mp3tag = new MP3Tag(original);

  mp3tag.read();
  mp3tag.tags.album = "Quran Central";
  mp3tag.save({ strict: true });

  // @ts-expect-error
  await writeFile(path, mp3tag.buffer);
};

const download = async (surah: string, path: string, file: string) => {
  const url = `https://media.blubrry.com/muslim_central_quran/podcasts.qurancentral.com/saad-al-ghamdi/saad-al-ghamdi-surah-${surah}.mp3`;

  try {
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const contentLength = parseInt(
      response.headers.get("content-length") || "0",
      10
    );

    let receivedLength = 0;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();

        while (true) {
          if (!reader) throw new Error("No reader!");

          const { done, value } = await reader.read();

          if (done) break;

          receivedLength += value.length;

          stdout.write(
            `[${((receivedLength / contentLength) * 100).toFixed(
              2
            )}%] ${file}\r`
          );

          controller.enqueue(value);
        }

        controller.close();
        reader.releaseLock();
      },
    });

    const blob = await new Response(stream).blob();

    const blobStream = blob.stream();
    const writeStream = createWriteStream(path);

    await pipeline(blobStream, writeStream);
  } catch (error) {
    console.error(error);
  }
};

const check = async (folder: string) => {
  try {
    await access(folder);
  } catch (error) {
    await mkdir(folder);
  }
};

const main = async () => {
  const folder = "downloads";

  await check(folder);

  for (let index = 1; index <= 114; index++) {
    const surah = index.toString().padStart(3, "0");
    const file = `Saad Al Ghamdi - Quran Surah ${surah}.mp3`;
    const path = join(folder, file);

    if (existsSync(path)) {
      await rename(path, file);
    } else {
      await download(surah, path, file);
    }
  }
};

// Call the function to download files sequentially
await main();
