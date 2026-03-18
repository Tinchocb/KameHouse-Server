import type { StorybookConfig } from "storybook-react-rsbuild"

const config: StorybookConfig = {
    stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [
        "@storybook/addon-links",
        "@storybook/addon-essentials",
        "@storybook/addon-interactions",
    ],
    framework: {
        name: "storybook-react-rsbuild",
        options: {},
    },
    docs: {
        autodocs: "tag",
    },
}
export default config
