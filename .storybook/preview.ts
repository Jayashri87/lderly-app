import "../app/globals.css";

const preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "lderly",
      values: [{ name: "lderly", value: "#06130f" }]
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
};

export default preview;
