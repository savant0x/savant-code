import { LAYOUT } from './project-picker-layout'
import { TerminalLink } from './terminal-link'
import { useTheme } from '../hooks/use-theme'
import { formatCwd } from '../utils/path-helpers'

interface ProjectPickerRecentsProps {
  projects: Array<{ path: string }>
  maxToShow: number
  isCompactMode: boolean
  onSelectProject: (projectPath: string) => void
}

/** Recent-projects list for the project picker (shown when space allows). */
export const ProjectPickerRecents = ({
  projects,
  maxToShow,
  isCompactMode,
  onSelectProject,
}: ProjectPickerRecentsProps) => {
  const theme = useTheme()

  return (
    <box
      style={{
        flexDirection: 'column',
        marginTop: isCompactMode ? 0 : LAYOUT.RECENTS_MARGIN_TOP,
        flexShrink: 0,
        gap: 0,
      }}
    >
      <text style={{ fg: theme.muted, height: 1 }}>Recent:</text>
      {projects.slice(0, maxToShow).map((project, idx) => (
        <box
          key={project.path}
          style={{
            flexDirection: 'row',
            gap: 1,
            paddingLeft: isCompactMode ? 0 : LAYOUT.RECENTS_PADDING_LEFT,
            height: 1,
          }}
        >
          <text style={{ fg: theme.secondary }}>[{idx + 1}]</text>
          <TerminalLink
            text={formatCwd(project.path)}
            onActivate={() => onSelectProject(project.path)}
            underlineOnHover={true}
            containerStyle={{ width: 'auto' }}
          />
        </box>
      ))}
    </box>
  )
}
