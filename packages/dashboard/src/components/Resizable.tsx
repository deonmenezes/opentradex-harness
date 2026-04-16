import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from 'react-resizable-panels';

export function ResizablePanelGroup(props: GroupProps) {
  return (
    <Group
      {...props}
      className={`flex h-full w-full aria-[orientation=vertical]:flex-col ${props.className || ''}`}
    />
  );
}

export function ResizablePanel(props: PanelProps) {
  return <Panel {...props} />;
}

export function ResizableHandle({
  withHandle,
  className,
  ...props
}: SeparatorProps & { withHandle?: boolean }) {
  return (
    <Separator
      {...props}
      className={[
        'group relative flex w-px items-center justify-center bg-border',
        'hover:bg-accent/60 focus-visible:bg-accent/80 transition-colors',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2',
        'aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full',
        'aria-[orientation=horizontal]:after:h-2 aria-[orientation=horizontal]:after:w-full',
        'aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2',
        className || '',
      ].join(' ')}
    >
      {withHandle && (
        <div className="z-10 flex h-6 w-3 items-center justify-center rounded-sm border border-border bg-surface-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-2.5 h-2.5 text-text-dim" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" />
            <circle cx="15" cy="5" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="15" cy="19" r="1.5" />
          </svg>
        </div>
      )}
    </Separator>
  );
}
