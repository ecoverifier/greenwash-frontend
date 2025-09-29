"use client";
import ReactGA from "react-ga4";

export const initGA = () => {
  if (typeof window !== "undefined") {
    ReactGA.initialize("G-EQJYCYQEQE"); // replace with your GA Measurement ID
  }
};

export const trackPageView = (url: string) => {
  if (typeof window !== "undefined") {
    ReactGA.send({ hitType: "pageview", page: url });
  }
};

export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  if (typeof window !== "undefined") {
    ReactGA.event({ category, action, label, value });
  }
};
