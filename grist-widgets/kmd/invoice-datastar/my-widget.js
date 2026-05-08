import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

export class GristWidget extends LitElement {
  static properties = {
    // record: { type: Object }, // Data passed from Grist via Datastar
    version: {},
  };

  constructor() {
    super();
    this.version = "STARTING";
  }

  render() {
    return html`
      <p></p>
      <h1>This is the ${this.version}</h1> 
    `;
  }

  // render() {
  //   if (!this.record) return html`<p>Waiting for Grist data...</p>`;
  //   return html`
  //     <div class="card">
  //       <h3>${this.record.Name || 'No Name'}</h3>
  //       <p>Status: ${this.record.Status}</p>
  //     </div>
  //   `;
  // }
}
customElements.define('grist-widget', GristWidget);
