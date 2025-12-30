import { useState, useMemo } from 'react'
import type { BoundingBox } from '../types'
import { CONFIG } from '../constants'
import { getUTMZone } from '../utils/coordinates'

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

interface UseBoundingBoxReturn {
  boundingBox: BoundingBox | null
  setBoundingBox: (box: BoundingBox | null) => void
  validationError: string | null
  isValid: boolean
  widthKm: number | null
  heightKm: number | null
}

export function useBoundingBox(): UseBoundingBoxReturn {
  const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null)

  const validation = useMemo(() => {
    if (!boundingBox) {
      return {
        error: null,
        isValid: false,
        widthKm: null,
        heightKm: null,
      }
    }

    const { minLng, minLat, maxLng, maxLat } = boundingBox

    // Calculate dimensions
    const widthKm = haversineDistance(
      (minLat + maxLat) / 2,
      minLng,
      (minLat + maxLat) / 2,
      maxLng
    )
    const heightKm = haversineDistance(
      minLat,
      (minLng + maxLng) / 2,
      maxLat,
      (minLng + maxLng) / 2
    )

    // Check size constraint (with small tolerance for floating point precision)
    const maxWithTolerance = CONFIG.MAX_BOX_SIZE_KM * 1.01
    if (widthKm > maxWithTolerance || heightKm > maxWithTolerance) {
      return {
        error: `Bounding box too large: ${widthKm.toFixed(1)}km x ${heightKm.toFixed(1)}km. Maximum is ${CONFIG.MAX_BOX_SIZE_KM}km x ${CONFIG.MAX_BOX_SIZE_KM}km.`,
        isValid: false,
        widthKm,
        heightKm,
      }
    }

    // Check UTM zone crossing
    const minZone = getUTMZone(minLng)
    const maxZone = getUTMZone(maxLng)
    if (minZone !== maxZone) {
      return {
        error: `Bounding box crosses UTM zone boundary (zones ${minZone} and ${maxZone}). Please draw within a single zone.`,
        isValid: false,
        widthKm,
        heightKm,
      }
    }

    return {
      error: null,
      isValid: true,
      widthKm,
      heightKm,
    }
  }, [boundingBox])

  return {
    boundingBox,
    setBoundingBox,
    validationError: validation.error,
    isValid: validation.isValid,
    widthKm: validation.widthKm,
    heightKm: validation.heightKm,
  }
}
