// Header control for the seasonal decorations: a native <select> (keyboard and screen-reader
// friendly) laid transparently over a small glass button that shows the season's icon.
import { SEASONS, SEASON_LABEL, seasonForDate, type Season, type SeasonChoice } from '../season'
import { IconLeaf, IconPumpkin, IconSnowflake, IconSparkle } from './Icons'

const ICON: Record<Season, () => React.JSX.Element> = {
  halloween: () => <IconPumpkin />,
  fall: () => <IconLeaf />,
  winter: () => <IconSnowflake />,
  none: () => <IconSparkle />,
}

export function SeasonPicker({ choice, season, onChange }: { choice: SeasonChoice; season: Season; onChange: (c: SeasonChoice) => void }) {
  const today = seasonForDate(new Date())
  const Icon = ICON[season]
  return (
    <label className="season-pick btn">
      <Icon />
      <span className="season-pick__text" aria-hidden="true">
        {season === 'none' ? 'Seasons' : SEASON_LABEL[season]}
      </span>
      <span className="sr-only">Seasonal decorations</span>
      <select value={choice} onChange={(e) => onChange(e.target.value as SeasonChoice)}>
        <option value="auto">Automatic ({SEASON_LABEL[today].toLowerCase()} today)</option>
        {SEASONS.map((s) => (
          <option key={s} value={s}>
            {s === 'none' ? 'Off' : SEASON_LABEL[s]}
          </option>
        ))}
      </select>
    </label>
  )
}
