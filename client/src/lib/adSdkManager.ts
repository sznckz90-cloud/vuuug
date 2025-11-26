type AdProviderId = 'monetag' | 'adsgram' | 'adexora' | 'adextra';

class AdSdkManager {
  private activeProvider: AdProviderId | null = null;
  private loadedScripts: Map<AdProviderId, HTMLScriptElement> = new Map();
  private isLoading: boolean = false;

  private cleanupGlobals(providerId: AdProviderId): void {
    const globalKeys: string[] = [];
    
    switch(providerId) {
      case 'monetag':
        globalKeys.push('show_10013974', '__monetag', '__mt');
        break;
      case 'adsgram':
        globalKeys.push('Adsgram');
        break;
      case 'adexora':
        globalKeys.push('adexora', 'showAdexora', '__adexora', 'Adexora');
        break;
      case 'adextra':
        globalKeys.push('adextra', '__adextra', 'AdExtra');
        break;
    }

    globalKeys.forEach((key) => {
      try {
        if (key in window) {
          delete (window as any)[key];
        }
      } catch (e) {
        (window as any)[key] = undefined;
      }
    });
  }

  private removeScript(providerId: AdProviderId): void {
    const script = this.loadedScripts.get(providerId);
    if (script && script.parentNode) {
      script.parentNode.removeChild(script);
      this.loadedScripts.delete(providerId);
    }

    // Remove all scripts from this provider
    const scriptUrls: Record<AdProviderId, string[]> = {
      monetag: ['libtl.com'],
      adsgram: ['adsgram.ai'],
      adexora: ['adexora.com'],
      adextra: ['adextra.io'],
    };

    scriptUrls[providerId].forEach(url => {
      const existingScripts = document.querySelectorAll(`script[src*="${url}"]`);
      existingScripts.forEach((s) => s.remove());
    });
  }

  private clearContainer(providerId: AdProviderId): void {
    const containerIds: Record<AdProviderId, string> = {
      monetag: 'monetag-ad-container',
      adsgram: 'adsgram-ad-container',
      adexora: 'adexora-ad-container',
      adextra: '353c332d4f2440f448057df79cb605e5d3d64ef0',
    };

    const container = document.getElementById(containerIds[providerId]);
    if (container) {
      container.innerHTML = '';
      container.style.display = 'none';
    }
    
    const fullscreenContainer = document.getElementById(`${providerId}-fullscreen`);
    if (fullscreenContainer) {
      fullscreenContainer.remove();
    }
  }

  async teardownAll(): Promise<void> {
    for (const providerId of ['monetag', 'adsgram', 'adexora', 'adextra'] as AdProviderId[]) {
      this.removeScript(providerId);
      this.cleanupGlobals(providerId);
      this.clearContainer(providerId);
    }
    this.activeProvider = null;
  }

  private loadScript(providerId: AdProviderId): Promise<void> {
    return new Promise((resolve, reject) => {
      const scriptConfig: Record<AdProviderId, { url: string; attributes?: Record<string, string> }> = {
        monetag: {
          url: '//libtl.com/sdk.js',
          attributes: {
            'data-zone': '10013974',
            'data-sdk': 'show_10013974'
          }
        },
        adsgram: {
          url: 'https://sad.adsgram.ai/js/sad.min.js'
        },
        adexora: {
          url: 'https://adexora.com/cdn/ads.js?id=1078'
        },
        adextra: {
          url: 'https://partner.adextra.io/jt/353c332d4f2440f448057df79cb605e5d3d64ef0.js'
        }
      };

      const config = scriptConfig[providerId];
      const script = document.createElement('script');
      script.async = true;
      script.src = config.url;

      if (config.attributes) {
        Object.entries(config.attributes).forEach(([key, value]) => {
          script.setAttribute(key, value);
        });
      }

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout loading ${providerId} SDK`));
      }, 10000);

      script.onload = () => {
        clearTimeout(timeout);
        this.loadedScripts.set(providerId, script);
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load ${providerId} SDK`));
      };

      document.head.appendChild(script);
    });
  }

  async showAd(
    providerId: AdProviderId,
    onComplete: () => void,
    onError: (error: any) => void,
    onSkip: () => void
  ): Promise<void> {
    if (this.isLoading) {
      onError(new Error('Another ad is loading'));
      return;
    }

    this.isLoading = true;

    try {
      await this.teardownAll();
      await new Promise(resolve => setTimeout(resolve, 100));

      await this.loadScript(providerId);
      await new Promise(resolve => setTimeout(resolve, 500));

      this.activeProvider = providerId;

      switch (providerId) {
        case 'monetag':
          await this.showMonetagAd(onComplete, onError);
          break;
        case 'adsgram':
          await this.showAdsgramAd(onComplete, onError);
          break;
        case 'adexora':
          await this.showAdexoraAd(onComplete, onError);
          break;
        case 'adextra':
          await this.showAdextraAd(onComplete, onError);
          break;
      }
    } catch (error) {
      console.error(`Error in showAd(${providerId}):`, error);
      onError(error);
    } finally {
      this.isLoading = false;
    }
  }

  private async showMonetagAd(onComplete: () => void, onError: (error: any) => void): Promise<void> {
    try {
      const showFn = (window as any).show_10013974;
      if (typeof showFn !== 'function') {
        throw new Error('Monetag SDK not initialized');
      }

      const result = await showFn();
      onComplete();
    } catch (error) {
      onError(error);
    }
  }

  private async showAdsgramAd(onComplete: () => void, onError: (error: any) => void): Promise<void> {
    try {
      const Adsgram = (window as any).Adsgram;
      if (!Adsgram) {
        throw new Error('AdsGram SDK not available. Open in Telegram.');
      }

      const adController = Adsgram.init({ blockId: 'int-18225' });
      await adController.show();
      onComplete();
    } catch (error) {
      onError(error);
    }
  }

  private async showAdexoraAd(onComplete: () => void, onError: (error: any) => void): Promise<void> {
    try {
      // Wait for Adexora SDK to be available
      let attempts = 0;
      while (!window.showAdexora && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (typeof (window as any).showAdexora === 'function') {
        await (window as any).showAdexora();
        onComplete();
      } else if (typeof (window as any).adexora === 'object') {
        // Alternative API
        await (window as any).adexora.show?.();
        onComplete();
      } else {
        throw new Error('Adexora SDK function not found');
      }
    } catch (error) {
      onError(error);
    }
  }

  private async showAdextraAd(onComplete: () => void, onError: (error: any) => void): Promise<void> {
    try {
      // AdExtra uses a fixed container ID
      const container = document.getElementById('353c332d4f2440f448057df79cb605e5d3d64ef0');
      
      if (!container) {
        throw new Error('AdExtra container not found');
      }

      // Show the container
      container.style.display = 'block';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.zIndex = '9999';
      container.style.background = 'rgba(0,0,0,0.95)';

      // Create close button
      const closeBtn = document.createElement('button');
      closeBtn.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: #fff;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        z-index: 10000;
        font-size: 14px;
      `;
      closeBtn.textContent = 'Close';
      closeBtn.onclick = () => {
        container.style.display = 'none';
        container.innerHTML = '';
        closeBtn.remove();
        onComplete();
      };
      document.body.appendChild(closeBtn);

      // The AdExtra SDK should take care of showing the ad in the container
      // Wait for the container to be populated
      let waited = 0;
      while (container.children.length === 0 && waited < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waited += 100;
      }

      // Auto-close and complete after 10 seconds
      setTimeout(() => {
        if (container.style.display !== 'none') {
          container.style.display = 'none';
          container.innerHTML = '';
          if (closeBtn.parentNode) closeBtn.remove();
          onComplete();
        }
      }, 10000);
    } catch (error) {
      onError(error);
    }
  }

  isProviderLoading(): boolean {
    return this.isLoading;
  }

  getActiveProvider(): AdProviderId | null {
    return this.activeProvider;
  }
}

export const adSdkManager = new AdSdkManager();
export type { AdProviderId };
