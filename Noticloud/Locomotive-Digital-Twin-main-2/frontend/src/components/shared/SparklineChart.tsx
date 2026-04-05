// src/components/shared/SparklineChart.tsx

import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

interface Props {
  data: number[]
  color?: string
  label?: string
  unit?: string
}

export function SparklineChart({ data, color = '#3b82f6', label, unit }: Props) {
  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { top: 4, bottom: 4, left: 4, right: 4 },
    xAxis: { type: 'category', show: false },
    yAxis: { type: 'value', show: false, scale: true },
    series: [{
      type: 'line',
      data,
      smooth: true,
      symbol: 'none',
      lineStyle: { color, width: 1.5 },
      areaStyle: { color, opacity: 0.08 },
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#161b26',
      borderColor: '#1e2736',
      textStyle: { color: '#e5e7eb', fontFamily: 'JetBrains Mono', fontSize: 11 },
      formatter: (params: { value: number }[]) => `${label ?? ''} ${params[0].value}${unit ?? ''}`,
    },
  }), [data, color, label, unit])

  return (
    <ReactECharts
      option={option}
      style={{ height: 50, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  )
}
