import MP3Tag from "mp3tag.js";
import { createWriteStream, existsSync } from "node:fs";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { stdout } from "node:process";
import { pipeline } from "node:stream/promises";

type Props = {
  surah: string;
  path: string;
  file: string;
};

const renameFile = async ({ surah, path, file }: Props) => {
  const mp3tag = new MP3Tag(await readFile(path));

  mp3tag.read();

  const album = "Quran Central";
  const title = `${surah} ${mp3tag.tags.title}`;

  if (mp3tag.tags.album === album && mp3tag.tags.title === title) return;

  mp3tag.tags.title = title;
  mp3tag.tags.album = album;

  mp3tag.save({ strict: true });

  // @ts-expect-error
  await writeFile(path, mp3tag.buffer);

  await rename(path, join(dirname(path), `${title}${extname(path)}`));

  stdout.write(`[Renamed] ${file}\r`);
};

const downloadFile = async ({ surah, path, file }: Props) => {
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
    const file = `${surah}.mp3`;
    const path = join(folder, file);

    if (existsSync(path)) {
      await renameFile({ surah, path, file });
    } else {
      await downloadFile({ surah, path, file });
    }
  }
};

// Call the function to download files sequentially
await main();
