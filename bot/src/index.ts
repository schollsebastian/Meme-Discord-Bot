import Discord from 'discord.js';
import dotenv from 'dotenv';
import MemeConfig from './meme-config.interface';
import fs from 'fs';
import { createCanvas, loadImage, registerFont } from 'canvas';

dotenv.config();

const IMAGE_WIDTH = 500;
const FONT_SIZE = 40;
const FONT_FAMILY = 'Roboto';
const ADMIN_ROLE = 'Memegod';

const token = process.env['NODE_ENV'] === 'development' ?
  process.env['DISCORD_DEV_TOKEN'] :
  process.env['DISCORD_PROD_TOKEN'];
const client = new Discord.Client();
const memes = new Map<string, MemeConfig>();

registerFont('src/fonts/Roboto-Regular.ttf', { family: FONT_FAMILY });

client.on('ready', () => {
  client.user!.setActivity('!say help', { type: 'LISTENING' });
  console.log(`Logged in as ${client.user!.tag}`);
  init();
});

client.on('message', async message => {
  if (message.content.startsWith('!say config')) {
    const text = message.content.indexOf(' ', 10) != -1
      ? message.content.substring(message.content.indexOf(' ', 10) + 1)
      : '';

    config(text, message);
  } else if (message.content.startsWith('!say help')) {
    help(message);
  } else if (message.content.startsWith('!say') || message.content.startsWith('!whisper')) {
    const memeName = message.content.split(' ')[1];
    const commandLength = message.content.startsWith('!say') ? 5 : 9;
    const text = message.content.indexOf(' ', commandLength) !== -1
      ? message.content.substring(message.content.indexOf(' ', commandLength + 1) + 1)
      : '';

    try {
      new URL(memeName);
      sendMeme(memeName, text, message)
        .then(() => {
          if (message.content.startsWith('!whisper')) {
            message.delete()
              .catch(console.error);
          }
        });
    } catch {
      if (!memes.has(memeName)) {
        message.channel.send('That meme doesn\'t exist!')
          .catch(console.error);
      } else {
        sendMeme(memes.get(memeName)!, text, message)
          .then(() => {
            if (message.content.startsWith('!whisper')) {
              message.delete()
                .catch(console.error);
            }
          });
      }
    }
  } else {
    for (const memeValue of Array.from(memes.values())) {
      if (memeValue.customPrefix !== undefined && message.content.startsWith(memeValue.customPrefix)) {
        const text = message.content.indexOf(' ') !== -1
          ? message.content.substring(message.content.indexOf(' ') + 1)
          : '';

        sendMeme(memeValue, text, message);
      }
    }
  }
});

client.login(token).catch(console.error);

function help(message: Discord.Message) {
  const help = '```!say [meme name] [text]\n'
    + '!whisper [meme name] [text]\n'
    + '!say help```\n'
    + 'Only for Admins and users with the Memegod role:\n'
    + '```!say config add [meme name] [image url] [custom prefix (optional)]\n'
    + '!say config add [meme name] [custom prefix (optional)] (send image as attachment)\n'
    + '!say config remove [meme name]\n'
    + '!say config list```';

  const embed = new Discord.MessageEmbed()
    .setColor('#0099ff')
    .setTitle('Memebot')
    .setURL('https://github.com/schollsebastian/Meme-Discord-Bot')
    .addField('Help', help);

  message.channel.send(embed)
    .catch(console.error);
}

function config(text: string, message: Discord.Message): void {
  if (!(message.member?.hasPermission('ADMINISTRATOR')
    || message.guild?.roles.cache.find(r => r.name === ADMIN_ROLE)?.members.has(message.author.id))) {
    message.channel.send("You don't have permission to do that!")
      .catch(console.error);
  } else {
    const commandText = text.indexOf(' ') !== -1
      ? text.substring(text.indexOf(' ') + 1)
      : '';

    if (text.startsWith('add')) {
      addMeme(commandText, message);
    } else if (text.startsWith('remove')) {
      removeMeme(commandText, message);
    } else if (text.startsWith('list')) {
      listMemes(message);
    } else {
      message.channel.send('Invalid operation!')
        .catch(console.error);
    }
  }
}

function listMemes(message: Discord.Message): void {
  let memeList = '';

  for (const meme of Array.from(memes.values())) {
    memeList += ` - ${meme.name}${meme.customPrefix !== undefined ? ` (\`${meme.customPrefix}\`)` : ''}\n`;
  }

  message.channel.send(`Available memes: \n${memeList}`)
    .catch(console.error);
}

async function removeMeme(text: string, message: Discord.Message): Promise<void> {
  if (text !== '') {
    if (!memes.has(text)) {
      message.channel.send("That meme doesn't exist!")
        .catch(console.error);
    } else {
      const meme = memes.get(text)!;

      memes.delete(text);
      await saveConfig(Array.from(memes.values()));

      fs.rmSync(`images/${meme.filename}`);

      message.channel.send(`Removed meme ${text}!`)
        .catch(console.error);
    }
  } else {
    message.channel.send('Please specify a name!')
      .catch(console.error);
  }
}

async function addMeme(text: string, message: Discord.Message): Promise<void> {
  if (text !== '') {
    const splitText = text.split(' ');
    const memeName = splitText[0];
    let imageUrl = message.attachments.size > 0 ? undefined : splitText[1];
    const customPrefix = message.attachments.size > 0 ? splitText[1] : splitText[2];

    if (memes.has(memeName) || [ 'config', 'help' ].includes(memeName)) {
      message.channel.send('That meme already exists!')
        .catch(console.error);
    } else if (Array.from(memes.values())
      .filter(m => m.customPrefix !== undefined)
      .map(m => m.customPrefix)
      .includes(customPrefix)) {
      message.channel.send('That prefix is already in use!')
        .catch(console.error);
    } else {
      if (message.attachments.size > 0) {
        const attachment = Array.from(message.attachments.values())
          .find(a => [ 'png', 'jpg', 'jpeg' ].includes(a.url.split('.').pop() ?? ''));

        if (attachment) {
          imageUrl = attachment.url;
        } else {
          message.channel.send('Unsupported image type!')
            .catch(console.error);
        }
      } else if (imageUrl !== undefined && imageUrl !== '') {
        try {
          new URL(imageUrl);
        } catch (e) {
          message.channel.send('Invalid URL!')
            .catch(console.error);
        }
      } else {
        message.channel.send('No image specified!')
          .catch(console.error);
      }

      if (imageUrl !== undefined) {
        try {
          await saveImage(imageUrl, memeName);
        } catch (e) {
          message.channel.send('Unsupported image type!')
            .catch(console.error);
        }

        memes.set(memeName, {
          name: memeName,
          filename: `${memeName}.png`,
          customPrefix: customPrefix
        });

        await saveConfig(Array.from(memes.values()));

        message.channel.send(`Added meme ${splitText[0]}!`)
          .catch(console.error);
      }
    }
  } else {
    message.channel.send('Please specify a name!')
      .catch(console.error);
  }
}

async function saveConfig(config: MemeConfig[]): Promise<void> {
  fs.writeFileSync('./src/config.json', JSON.stringify(config, null, 2));
}

async function init(): Promise<void> {
  if (!fs.existsSync('./src/config.json')) {
    fs.copyFileSync('./src/config.template.json', './src/config.json');
    console.log('Created config.json');
  }

  if (!fs.existsSync('./images')) {
    fs.mkdirSync('./images');
    console.log('Created images directory');
  }

  const config: MemeConfig[] = JSON.parse(fs.readFileSync('./src/config.json', 'utf8'));

  for (const meme of config) {
    memes.set(meme.name, meme);
  }
}

async function saveImage(url: string, filename: string): Promise<void> {
  const image = await loadImage(url);
  const imageHeight = image.height * IMAGE_WIDTH / image.width;

  const canvas = createCanvas(IMAGE_WIDTH, imageHeight);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0, IMAGE_WIDTH, imageHeight);

  fs.writeFileSync(`images/${filename}.png`, canvas.toBuffer());
}

async function sendMeme(meme: MemeConfig | string, text: string, message: Discord.Message): Promise<void> {
  if (text !== '') {
    try {
      message.channel.send(new Discord.MessageAttachment(await drawImage(meme, text),
        `${typeof meme === 'string' ? 'meme' : meme.name}.png`))
        .catch(console.error);
    } catch (e) {
      message.channel.send('Unsupported image type!')
        .catch(console.error);
    }
  } else {
    message.channel.send('No text provided!')
      .catch(console.error);
  }
}

async function drawImage(meme: MemeConfig | string, text: string): Promise<Buffer> {
  const image = typeof meme === 'string' ? await loadImage(meme) : await loadImage(`images/${meme.filename}`);
  const imageHeight = image.height * IMAGE_WIDTH / image.width;

  const canvas = createCanvas(IMAGE_WIDTH, imageHeight);
  const ctx = canvas.getContext('2d');

  const wrappedText = wrapText(text, IMAGE_WIDTH - 20, ctx);

  ctx.drawImage(image, 0, 0, IMAGE_WIDTH, imageHeight);

  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'black';

  for (let i = 0; i < wrappedText.length; i++) {
    const x = IMAGE_WIDTH / 2;
    const y = imageHeight - FONT_SIZE * (wrappedText.length - 1 - i) - 30;

    ctx.fillText(wrappedText[i], x, y);
    ctx.strokeText(wrappedText[i], x, y);
  }

  return canvas.toBuffer();
}

function wrapText(text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const testLine = `${line}${word} `;
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    const { width } = ctx.measureText(testLine);

    if (width > maxWidth && line !== '') {
      lines.push(line.trimEnd());
      line = `${word} `;
    } else {
      line = testLine;
    }
  }

  if (line !== '') {
    lines.push(line.trimEnd());
  }

  return lines;
}
