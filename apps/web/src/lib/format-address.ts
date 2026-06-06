export function formatAddress(
  address: string,
  prefixLength = 6,
  suffixLength = 4
) {
  if (address.length <= prefixLength + suffixLength) {
    return address
  }

  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`
}
