import Vue from "vue";
import Component from "vue-class-component";
import App from "../app/app";
import ChampionDropdown from "../champion-dropdown/champion-dropdown.vue";
import RoleConditions from "../role-tree/role-conditions.vue";
import { default as RoleConditionsTy } from "../role-tree/role-conditions";
import PresetsModal from "../presets/presets.vue";

export interface Role {
    id: number;
    name: string;
    snowflake: string;
    announce: boolean;
    conditions: {
        type: string;
        options: any;
    }[];
}

export interface DiscordRole {
    id: string;
    name: string;
    color: string;
    position: number;
}

interface ServerDetails {
    snowflake: string;
    name: string;
    avatar: string;
    announcement_channel: string | null;
    default_champion: number | null;
    roles: Role[];
    blacklisted_channels: string[];
    discord: {
        channels: { id: string, name: string }[];
        roles: DiscordRole[];
        highestRole: number;
    }
}

@Component({
    components: { ChampionDropdown, RoleConditions }
})
export default class ServerProfile extends Vue {
    $root: App;
    server: ServerDetails = <any>null; // required for vue to register the binding
    blacklistChannel = "disabled";
    roleName = "";
    message = "";
    rolesDirty = false;
    timeoutID: number = 0;
    $refs: { roleElements: RoleConditionsTy[] };

    async mounted() {
        // Load user details. Will error if the user is not logged in.
        this.server = (await this.$root.get<ServerDetails>("/api/v1/server/" + this.$route.params.id))!;
    }

    /**
     * Updates the selected announcement channel with the server.
     */
    private async updateAnnouncementChannel(evt: Event) {
        let val: string | null = (<HTMLSelectElement>evt.target).value;
        if (val === "null") val = null;

        this.server.announcement_channel = val;
        await this.$root.submit("/api/v1/server/" + this.$route.params.id, "PATCH", {
            announcement_channel: val
        });

        if (val) {
            this.showMessage(`Announcements will now be sent in #${this.getChannelName(val)}!`);
        } else {
            this.showMessage("Announcements are now turned off.");
        }
    }

    /**
     * Updates the selected default champion with the server.
     */
    private async updateDefaultChampion(champ: number) {
        this.server.default_champion = champ;
        await this.$root.submit("/api/v1/server/" + this.$route.params.id, "PATCH", {
            default_champion: champ
        });

        this.showMessage(champ ? "Updated default server champion!" : "Default champion removed. All commands will now require a champion name.");
    }

    /**
     * Marks the currently selected blacklist channel as being blacklisted.
     */
    private async addBlacklistedChannel() {
        if (this.blacklistChannel === "disabled") return;

        await this.$root.submit("/api/v1/server/" + this.$route.params.id + "/blacklisted_channels", "POST", {
            channel: this.blacklistChannel
        });
        this.showMessage(`Will now ignore all commands sent in #${this.getChannelName(this.blacklistChannel)}.`);

        this.server.blacklisted_channels.push(this.blacklistChannel);
        this.blacklistChannel = "undefined";
    }

    /**
     * Removes the specified channel ID from the blacklist.
     */
    private async removeBlacklist(id: string) {
        await this.$root.submit("/api/v1/server/" + this.$route.params.id + "/blacklisted_channels", "DELETE", {
            channel: id
        });
        this.showMessage(`Will no longer ignore commands sent in #${this.getChannelName(id)}.`);

        this.server.blacklisted_channels.splice(this.server.blacklisted_channels.indexOf(id), 1);
    }

    /**
     * Deletes the specified role.
     */
    private async deleteRole(role: Role) {
        await this.$root.submit("/api/v1/server/" + this.$route.params.id + "/role/" + role.id, "DELETE", {});
        this.showMessage(`Removed ${role.name}.`);
        this.server.roles.splice(this.server.roles.indexOf(role), 1);
    }

    /**
     * Adds a new role.
     */
    private async addRole() {
        if (!this.roleName) return;
        const role = await this.$root.submit("/api/v1/server/" + this.$route.params.id + "/role", "POST", {
            name: this.roleName
        });
        if (!role) return;
        this.showMessage(`Added ${this.roleName}!`);

        this.server.roles.push(role);
        this.roleName = "";
    }

    /**
     * Opens the presets modal.
     */
    private async openPresetsModal() {
        const res = await this.$root.displayModal<boolean | null>(PresetsModal, { id: this.$route.params.id });
        if (!res) return;

        // Reload roles, since we don't know what the user added.
        this.server = (await this.$root.get<ServerDetails>("/api/v1/server/" + this.$route.params.id))!;
    }

    /**
     * Saves all dirty roles.
     */
    private async saveUnsavedRoles() {
        await Promise.all(this.$refs.roleElements.filter(x => x.dirty).map(x => x.save()));
        this.showMessage("All roles saved!");
    }

    /**
     * Recomputes if any roles are dirty.
     */
    private updateDirty() {
        this.rolesDirty = this.$refs.roleElements.some(x => x.dirty);
    }

    /**
     * Shows a small message at the bottom.
     */
    private showMessage(msg: string) {
        this.message = msg;
        if (this.timeoutID) clearTimeout(this.timeoutID);
        this.timeoutID = setTimeout(() => {
            this.message = "";
        }, 2000);
    }

    /**
     * Finds the channel name for the specified ID. Assumes the channel exists.
     */
    private getChannelName(id: string) {
        return this.server.discord.channels.find(x => x.id === id)!.name;
    }

    /**
     * Returns all the blacklisted channels in the server.
     */
    get blacklistedChannels() {
        if (!this.server) return [];
        return this.server.discord.channels.filter(x => this.server.blacklisted_channels.indexOf(x.id) !== -1);
    }

    /**
     * Returns all the channels that are _not_ blacklisted in the server.
     */
    get unblacklistedChannels() {
        if (!this.server) return [];
        return this.server.discord.channels.filter(x => this.server.blacklisted_channels.indexOf(x.id) === -1);
    }

    /**
     * @returns all currently known discord role names
     */
    get roleNames() {
        return this.server.discord.roles.map(x => x.name);
    }
}