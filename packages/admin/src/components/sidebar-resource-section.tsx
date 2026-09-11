import React from 'react'
import { Navigation, type NavigationElementProps } from '@adminjs/design-system'
import { useLocation, useNavigate } from 'react-router'
import { useNavigationResources, useTranslation } from 'adminjs'

type Props = {
  resources: Parameters<typeof useNavigationResources>[0]
}

const statisticsPath = '/admin/pages/statistics'

const SidebarResourceSection = ({ resources }: Props) => {
  const resourceElements = useNavigationResources(resources)
  const { translateLabel, translatePage } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const isStatisticsSelected =
    location.pathname === '/admin' || location.pathname.startsWith(statisticsPath)
  const statisticsElement: NavigationElementProps = {
    id: 'statistics',
    label: translatePage('statistics'),
    icon: 'BarChart2',
    href: statisticsPath,
    isSelected: isStatisticsSelected,
    onClick: (event, element): void => {
      event.preventDefault()
      if (element.href) navigate(element.href)
    },
  }

  return (
    <Navigation
      label={translateLabel('navigation')}
      elements={[statisticsElement, ...resourceElements]}
    />
  )
}

export default SidebarResourceSection
