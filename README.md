# Meme-Discord-Bot

Create memes quickly in Discord.

## Invite the bot

https://discordapp.com/oauth2/authorize?&client_id=916227104666968074&scope=bot&permissions=108544

## Usage

- `!say [meme name] [text]`
- `!whisper [meme name] [text]`
- `!say help`

## Web

This bot also includes a web frontend that displays all memes. It can be
viewed at [localhost](http://localhost).

**Note**: Because Angular's memory consumption during build is just insane
and some Cloud VMs can't handle that, you need to run `npm run build` before
starting the Docker services with `docker-compose up -d`. If you want Docker
to do the building for you, you can use the `Dockerfile` in the `web` directory.

### Only for Admins and users with the Memegod role

- `!say config add [meme name] [image url] [custom prefix (optional)]`
- `!say config add [meme name] [custom prefix (optional)] (send image as attachment)`
- `!say config remove [meme name]`
- `!say config list`

## For Developers

### Create a Discord Application

If you want to run the bot yourself, [create a new Discord Bot](https://discordapp.com/developers/docs/intro#bots-and-apps).
Then make a copy of `template.env` and call it `.env` and copy your token into this file. In most cases using the same
token as `DISCORD_DEV_TOKEN` and `DISCORD_PROD_TOKEN` should be sufficient. However, if you want to work on the bot
while an instance is running, you should create a second bot and use it's token as `DISCORD_ENV_TOKEN`.

### Get your invite link

To create an invite link for your bot, replace `916227104666968074` in the link above with the Client ID of your Discord Application.

### Start the Bot

#### Development

```shell
npm install
npm run start:dev
```

#### Production

```shell
docker-compose up -d
```
