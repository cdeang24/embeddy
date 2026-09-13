import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { type Message, PermissionFlagsBits, TextChannel } from 'discord.js';

interface ReplacementRule {
  name: string;
  match: string;
  replace: string;
}

const urlReplacements = [
  {
    "name": "Twitter/X",
    "match": "(twitter|x)\\.com",
    "replace": "fxtwitter.com"
  },
  {
    "name": "Reddit",
    "match": "reddit\\.com",
    "replace": "vxreddit.com"
  },
  {
    "name": "Instgram",
    "match": "instagram\\.com",
    "replace": "kkinstagram.com"
  }
]

@ApplyOptions<Listener.Options>({
    event: 'messageCreate'
})
export class UserEvent extends Listener {
    public override async run(message: Message) {
        // 1. Ignore bots, empty lists, and ensure this occurs inside a guild text channel
        if (message.author.bot || !urlReplacements.length || !message.inGuild() || !(message.channel instanceof TextChannel)) {
            return;
        }

        let content = message.content;
        let replaced = false;

        // 2. Loop through rules dynamically with type enforcement
        for (const rule of urlReplacements as ReplacementRule[]) {
            const dynamicRegex = new RegExp(`https?:\\/\\/(www\\.)?${rule.match}`, 'i');
            
            if (dynamicRegex.test(content)) {
                const replaceRegex = new RegExp(rule.match, 'i');
                content = content.replace(replaceRegex, rule.replace);
                replaced = true;
            }
        }

        // 3. Process the webhook pipeline if a match occurred
        if (replaced) {
            try {
                const botMember = message.guild?.members.me;
                if (!botMember) return;

                // Verify the bot has the correct raw permission bitwise flags in TypeScript
                const permissions = message.channel.permissionsFor(botMember);
                if (!permissions || !permissions.has([PermissionFlagsBits.ManageWebhooks, 'ManageMessages'])) {
                return;
                }

                // 4. Locate or instantiate a webhook
                const webhooks = await message.channel.fetchWebhooks();
                let webhook = webhooks.find(wh => wh.owner?.id === this.container.client.user?.id);

                if (!webhook) {
                webhook = await message.channel.createWebhook({
                    name: 'Link Fixer Webhook',
                    avatar: this.container.client.user?.displayAvatarURL(),
                    reason: 'Required for seamless link replacements.'
                });
                }

                // 5. Fire payload using member details or author details fallback
                await webhook.send({
                content: content,
                username: message.member?.displayName || message.author.username,
                avatarURL: message.author.displayAvatarURL({ forceStatic: false }),
                allowedMentions: { parse: [] } 
                });

                // 6. Delete the unoptimized post
                await message.delete().catch(() => null);

            } catch (error) {
                this.container.logger.error('Failed to process TS dynamic link replacement:', error);
            }
        }
    }
}
