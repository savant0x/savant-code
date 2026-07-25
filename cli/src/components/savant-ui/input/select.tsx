import React, { useState } from 'react';

import { useTheme } from '../../../hooks/use-theme';
export interface SelectOption {
    label: string;
    value: string;
    disabled?: boolean;
}
export interface SelectProps {
    options: SelectOption[];
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
}
export function Select({ options, value, onChange, placeholder }: SelectProps) {
    const theme = useTheme();
    const [_isOpen, _setIsOpen] = useState(false);
    const selected = options.find((o) => o.value === value);
    return (<box flexDirection="column">
      <text fg={selected ? theme.foreground : theme.muted}>
        {selected?.label ?? placeholder ?? 'Select...'}
      </text>
    </box>);
}
