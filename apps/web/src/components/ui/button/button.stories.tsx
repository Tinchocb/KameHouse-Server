import type { Meta, StoryObj } from "@storybook/react"
import { Button } from "./button"
import { Search, Mail, Loader2, Play } from "lucide-react"

const meta: Meta<typeof Button> = {
    title: "UI/Button",
    component: Button,
    tags: ["autodocs"],
    argTypes: {
        intent: {
            control: "select",
            options: [
                "primary", "primary-outline", "primary-subtle", "primary-glass", "primary-glow",
                "warning", "warning-outline", "warning-subtle", "warning-glass", "warning-glow",
                "success", "success-outline", "success-subtle", "success-glass", "success-glow",
                "alert", "alert-outline", "alert-subtle", "alert-glass",
                "gray", "gray-outline", "gray-subtle", "gray-glass",
                "white", "white-outline", "white-subtle", "white-glass"
            ],
        },
        size: {
            control: "select",
            options: ["xs", "sm", "md", "lg", "xl"],
        },
        rounded: { control: "boolean" },
        loading: { control: "boolean" },
        disabled: { control: "boolean" },
    },
    args: {
        children: "Button",
        intent: "primary",
        size: "md",
        rounded: true,
    },
}

export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
    args: {
        children: "Primary Button",
        intent: "primary",
    },
}

export const Glowing: Story = {
    args: {
        children: "Glowing Action",
        intent: "primary-glow",
    },
}

export const Glass: Story = {
    args: {
        children: "Glass Effect",
        intent: "primary-glass",
    },
}

export const WithIcons: Story = {
    args: {
        children: "Send Email",
        leftIcon: <Mail size={16} />,
        intent: "primary",
    },
}

export const OnlyIcon: Story = {
    args: {
        children: null,
        leftIcon: <Search size={16} />,
        intent: "gray-subtle",
        contentWidth: true,
    },
}

export const Loading: Story = {
    args: {
        children: "Processing",
        loading: true,
        intent: "primary",
    },
}

export const Danger: Story = {
    args: {
        children: "Delete Item",
        intent: "alert",
    },
}

export const Sizes: Story = {
    render: (args) => (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
                <Button {...args} size="xs">XS Button</Button>
                <Button {...args} size="sm">SM Button</Button>
                <Button {...args} size="md">MD Button</Button>
                <Button {...args} size="lg">LG Button</Button>
                <Button {...args} size="xl">XL Button</Button>
            </div>
        </div>
    ),
}
