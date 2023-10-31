import "dotenv/config";
import * as fs from "fs";

import { login, getAndSend, handleLatestMessage } from "./api/instagram";

import config from "./config.json";

import { clientHandle, intervalChecks, sleep } from "./util";

const client = clientHandle(() => login({ client }));

const main = async () => {
  intervalChecks({ prompt: config.prompt });

  let isLogin: string;
  try {
    isLogin = fs.readFileSync("./login.json", "utf-8");
  } catch {
    fs.writeFileSync("./login.json", "");
  }

  if (!isLogin) {
    await login({ client }).catch(() => {});
  }

  if (isLogin) {
    await client.state.deserialize(JSON.parse(isLogin));
  }

  console.log(`Watching for messages. (${config.waitTime} seconds)`);

  let collectedThreads: { id: string; messages: string[] }[] = [];
  client.realtime.on("message", async (message) => {
    const newThreads = await handleLatestMessage({
      client,
      message,
      collectedThreads,
    });

    if (newThreads) {
      collectedThreads = newThreads;
    }
  });

  await client.realtime.connect({
    irisData: await client.feed.directInbox().request(),
  });

  while (true) {
    if (collectedThreads.length > 0) {
      collectedThreads.forEach(async (thread) => {
        await getAndSend({
          client,
          thread: thread.id,
          allMessages: thread.messages,
        });

        collectedThreads = collectedThreads.filter(
          (item) => item.id !== thread.id
        );

        console.log(`\nWatching for messages. (${config.waitTime} seconds)`);
      });
    }

    await sleep({ seconds: config.waitTime });
  }
};

main();
