param([string]$OutputDirectory = (Join-Path $PSScriptRoot '..\extension\icons'))

Add-Type -AssemblyName System.Drawing

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null

foreach ($size in @(16, 32, 48, 128)) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $padding = if ($size -eq 128) { [single]16 } else { [single]0 }
    $drawSize = [single]($size - ($padding * 2))
    $rect = [System.Drawing.RectangleF]::new($padding, $padding, $drawSize, $drawSize)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $radius = [single]($drawSize * 0.27)
    $diameter = [single]($radius * 2)
    $path.AddArc($padding, $padding, $diameter, $diameter, 180, 90)
    $path.AddArc($padding + $drawSize - $diameter, $padding, $diameter, $diameter, 270, 90)
    $path.AddArc($padding + $drawSize - $diameter, $padding + $drawSize - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($padding, $padding + $drawSize - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()

    $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, [System.Drawing.Color]::FromArgb(143, 114, 255), [System.Drawing.Color]::FromArgb(91, 61, 214), 45)
    $graphics.FillPath($gradient, $path)

    $penWidth = [single][Math]::Max(1.4, $drawSize * 0.095)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, $penWidth)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $left = [single]($padding + $drawSize * 0.27)
    $top = [single]($padding + $drawSize * 0.27)
    $right = [single]($padding + $drawSize * 0.73)
    $bottom = [single]($padding + $drawSize * 0.73)
    $graphics.DrawLine($pen, $left, $top, $left, $bottom)
    $graphics.DrawLine($pen, $left, $top, $right, $top)
    $graphics.DrawLine($pen, $left, $bottom, $right, $bottom)

    $triangle = @(
        [System.Drawing.PointF]::new($padding + $drawSize * 0.44, $padding + $drawSize * 0.39),
        [System.Drawing.PointF]::new($padding + $drawSize * 0.69, $padding + $drawSize * 0.50),
        [System.Drawing.PointF]::new($padding + $drawSize * 0.44, $padding + $drawSize * 0.61)
    )
    $graphics.FillPolygon([System.Drawing.Brushes]::White, $triangle)

    $target = Join-Path $resolvedOutput "icon-$size.png"
    $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    $pen.Dispose()
    $gradient.Dispose()
    $path.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

Write-Output "Generated Chanlume icons in $resolvedOutput"
