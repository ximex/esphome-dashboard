import { LitElement, PropertyValues, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "@material/mwc-dialog";
import "@material/mwc-button";
import { supportedPlatforms, SupportedPlatforms } from "../../../src/const";
import {
  openInstallWebDialog,
  preloadInstallWebDialog,
} from "../../../src/install-web";
import { FileToFlash } from "../../../src/web-serial/flash";
import { esphomeDialogStyles } from "../../../src/styles";

const SUPPORTED_PLATFORMS = Object.keys(
  supportedPlatforms,
) as SupportedPlatforms[];

@customElement("esphome-install-adoptable-dialog")
class ESPHomeInstallAdoptableDialog extends LitElement {
  public port!: SerialPort;

  @state()
  private _installRequested = false;

  protected firstUpdated(changedProperties: PropertyValues): void {
    super.firstUpdated(changedProperties);
    preloadInstallWebDialog();
  }

  protected render() {
    return html`
      <mwc-dialog
        open
        heading="Prepare your device for first use"
        scrimClickAction
        @closed=${this._handleClose}
      >
        <div>
          This will install a basic version of ESPHome to your device and help
          you connect it to your network.
        </div>
        <div>
          Once installed, your ESPHome Device Builder will show the device and
          allow you to "take control". This will create a local configuration
          for the device and allows you to further manage it wirelessly.
        </div>

        <mwc-button
          slot="primaryAction"
          label="Install"
          @click=${this._handleInstall}
          .disabled=${this._installRequested}
        ></mwc-button>
        <mwc-button
          no-attention
          slot="secondaryAction"
          dialogAction="close"
          label="Close"
          .disabled=${this._installRequested}
        ></mwc-button>
      </mwc-dialog>
    `;
  }

  private async _handleInstall() {
    this._installRequested = true;
    openInstallWebDialog(
      {
        port: this.port,
        async filesCallback(
          platform: SupportedPlatforms,
        ): Promise<FileToFlash[]> {
          if (!SUPPORTED_PLATFORMS.includes(platform)) {
            throw new Error(
              `Unsupported platform ${platform}. Only ${SUPPORTED_PLATFORMS.join(
                ", ",
              )} are supported.`,
            );
          }

          const manifestResp = await fetch(
            "https://firmware.esphome.io/esphome-web/manifest.json",
          );
          if (!manifestResp.ok) {
            throw new Error(
              `Downloading ESPHome manifest failed (${manifestResp.status})`,
            );
          }
          const version = (await manifestResp.json())["version"];

          const platformLower = platform.toLowerCase();
          const resp = await fetch(
            `https://firmware.esphome.io/esphome-web/${version}/esphome-web-${platformLower}.factory.bin`,
          );
          if (!resp.ok) {
            throw new Error(
              `Downlading ESPHome firmware for ${platform} failed (${resp.status})`,
            );
          }

          const reader = new FileReader();
          const blob = await resp.blob();

          const data = await new Promise<string>((resolve) => {
            reader.addEventListener("load", () =>
              resolve(reader.result as string),
            );
            reader.readAsBinaryString(blob);
          });

          return [{ data, address: 0 }];
        },
        async onClose(success) {
          if (!success) {
            return;
          }
          import("improv-wifi-serial-sdk/dist/serial-provision-dialog");
          const improv = document.createElement(
            "improv-wifi-serial-provision-dialog",
          );
          improv.port = this.port;
          document.body.appendChild(improv);
        },
      },
      () => this._close(),
    );
  }

  private _close() {
    this.shadowRoot!.querySelector("mwc-dialog")!.close();
  }

  private async _handleClose() {
    this.parentNode!.removeChild(this);
  }

  static styles = esphomeDialogStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    "esphome-install-adoptable-dialog": ESPHomeInstallAdoptableDialog;
  }
}
