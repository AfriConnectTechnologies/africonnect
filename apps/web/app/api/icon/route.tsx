/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sizeParam = searchParams.get('size')
  const size = sizeParam ? parseInt(sizeParam, 10) : 192

  // Validate size
  const validSize = Math.min(Math.max(size, 16), 1024)

  // Read the logo image
  const logoData = await readFile(join(process.cwd(), 'public', 'logo2.webp'))
  const logoBase64 = `data:image/webp;base64,${logoData.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: validSize,
          height: validSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={logoBase64}
          alt="AfriConnect"
          width={validSize}
          height={validSize}
          style={{
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    {
      width: validSize,
      height: validSize,
    }
  )
}
