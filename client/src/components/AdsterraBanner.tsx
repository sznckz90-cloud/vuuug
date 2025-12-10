import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface AdsterraBannerProps {
  size?: "300x250" | "320x50";
  className?: string;
}

export default function AdsterraBanner({ size = "300x250", className = "" }: AdsterraBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  const { data: appSettings } = useQuery<any>({
    queryKey: ["/api/app-settings"],
    retry: false,
  });

  const isAdultAdsEnabled = appSettings?.adultAdsEnabled ?? false;

  useEffect(() => {
    if (!isAdultAdsEnabled || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    container.innerHTML = "";

    try {
      const width = size === "300x250" ? 300 : 320;
      const height = size === "300x250" ? 250 : 50;

      const wrapper = document.createElement("div");
      wrapper.id = `adsterra-container-${Date.now()}`;
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
      wrapper.style.overflow = "hidden";

      const optionsScript = document.createElement("script");
      optionsScript.type = "text/javascript";
      optionsScript.text = `
        atOptions = {
          'key': '28130837',
          'format': 'iframe',
          'height': ${height},
          'width': ${width},
          'params': {}
        };
      `;
      wrapper.appendChild(optionsScript);

      const invokeScript = document.createElement("script");
      invokeScript.type = "text/javascript";
      invokeScript.src = "//www.topcreativeformat.com/28130837/invoke.js";
      invokeScript.async = true;
      invokeScript.onload = () => {
        setAdLoaded(true);
        setAdError(false);
      };
      invokeScript.onerror = () => {
        setAdError(true);
        setAdLoaded(false);
      };
      wrapper.appendChild(invokeScript);

      container.appendChild(wrapper);
    } catch (error) {
      console.error("Error loading Adsterra banner:", error);
      setAdError(true);
    }

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [isAdultAdsEnabled, size]);

  if (!isAdultAdsEnabled) {
    return null;
  }

  const width = size === "300x250" ? 300 : 320;
  const height = size === "300x250" ? 250 : 50;

  return (
    <div
      className={`adsterra-banner-container flex items-center justify-center ${className}`}
      style={{
        width: "100%",
        maxWidth: `${width}px`,
        height: `${height}px`,
        margin: "0 auto",
        backgroundColor: "#111111",
        borderRadius: "12px",
        border: "1px solid #2A2A2A",
        overflow: "hidden",
      }}
    >
      <div 
        ref={containerRef} 
        className="adsterra-ad-wrapper"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!adLoaded && !adError && (
          <div className="text-xs text-gray-500 animate-pulse">Loading ad...</div>
        )}
      </div>
      {adError && (
        <div 
          className="text-xs text-gray-600"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        />
      )}
    </div>
  );
}
