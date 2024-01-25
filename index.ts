import { constants, createWriteStream } from "fs";
import { access, mkdir } from "fs/promises";
import { join } from "path";
import { stdout } from "process";
import { pipeline } from "stream/promises";

const download = async (url: string, path: string, file: string) => {
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
    const url = `https://media.blubrry.com/muslim_central_quran/podcasts.qurancentral.com/saad-al-ghamdi/saad-al-ghamdi-surah-${surah}.mp3`;

    const file = `Saad Al Ghamdi - Quran Surah ${surah}.mp3`;
    const path = join(folder, file);

    try {
      await access(path, constants.F_OK);
    } catch (error) {
      await download(url, path, file);
    }
  }
};

// Call the function to download files sequentially
await main();
