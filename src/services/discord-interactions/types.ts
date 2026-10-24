export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  url?: string;
}

export interface DiscordSelectMenuOption {
  label: string;
  value: string;
  description?: string;
  emoji?: { name: string; id?: string };
  default?: boolean;
}

export interface DiscordSelectMenuComponent {
  type: 3; // StringSelectMenu
  custom_id: string;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  options: DiscordSelectMenuOption[];
}

export interface DiscordTextInputComponent {
  type: 4; // TextInput
  custom_id: string;
  style: 1 | 2; // 1 = Short, 2 = Paragraph
  label: string;
  placeholder?: string;
  required?: boolean;
  min_length?: number;
  max_length?: number;
  value?: string;
}

export interface DiscordButtonComponent {
  type: 2; // Button
  custom_id?: string;
  style: 1 | 2 | 3 | 4 | 5; // 1 = Primary, 2 = Secondary, 3 = Success, 4 = Danger, 5 = Link
  label: string;
  emoji?: { name: string; id?: string };
  disabled?: boolean;
  url?: string;
}

export interface DiscordActionRowComponent {
  type: 1; // ActionRow
  components: (
    | DiscordSelectMenuComponent
    | DiscordTextInputComponent
    | DiscordButtonComponent
  )[];
}

export interface DiscordInteractionDataOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  focused?: boolean;
  options?: DiscordInteractionDataOption[];
}

export interface DiscordInteractionPayload {
  type: number; // 1=PING, 2=COMMAND, 3=COMPONENT, 4=AUTOCOMPLETE, 5=MODAL_SUBMIT
  token: string;
  id: string;
  data?: {
    id?: string;
    name?: string;
    custom_id?: string;
    component_type?: number;
    values?: string[];
    options?: DiscordInteractionDataOption[];
    components?: {
      type: number;
      components: {
        type: number;
        custom_id: string;
        value: string;
      }[];
    }[];
  };
  member?: {
    user: {
      id: string;
      username: string;
    };
  };
  user?: {
    id: string;
    username: string;
  };
}

export interface DiscordAutocompleteChoice {
  name: string;
  value: string;
}

export interface DiscordInteractionResponse {
  type: number; // 1=PONG, 4=CHANNEL_MESSAGE, 7=UPDATE_MESSAGE, 8=AUTOCOMPLETE, 9=MODAL
  data?: {
    content?: string;
    embeds?: DiscordEmbed[];
    components?: DiscordActionRowComponent[];
    flags?: number; // 64 = EPHEMERAL
    choices?: DiscordAutocompleteChoice[];
    title?: string;
    custom_id?: string;
  };
}

export const DISCORD_COLORS = {
  GREEN: 0x2ecc71,
  RED: 0xe74c3c,
  GOLD: 0xf1c40f,
  BLUE: 0x3498db,
  PURPLE: 0x9b59b6,
};
