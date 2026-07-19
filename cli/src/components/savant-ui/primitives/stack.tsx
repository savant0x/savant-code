import React from 'react'

export interface StackProps {
  direction?: 'horizontal' | 'vertical'
  gap?: number
  align?: 'flex-start' | 'flex-end' | 'center' | 'stretch'
  justify?: 'flex-start' | 'flex-end' | 'space-between' | 'center'
  wrap?: boolean
  children: React.ReactNode
  [key: string]: any
}

export function Stack({
  direction = 'vertical',
  gap = 0,
  align,
  justify,
  wrap,
  children,
  ...props
}: StackProps) {
  return (
    <box
      flexDirection={direction === 'horizontal' ? 'row' : 'column'}
      gap={gap}
      alignItems={align}
      justifyContent={justify}
      flexWrap={wrap ? 'wrap' : undefined}
      {...props}
    >
      {children}
    </box>
  )
}
