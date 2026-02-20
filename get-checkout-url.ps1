$response = curl.exe -sS -X POST "http://localhost:3001/create-checkout-session" -H "Content-Type: application/json" --data-binary "@tva_checkout_body.json"
Write-Output $response
Write-Output (($response | ConvertFrom-Json).url)
