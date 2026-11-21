import type { ItemsPort } from './items/items-port.ts'
import { HomeScreen } from './home/HomeScreen.tsx'
import type { RecipeStore } from './recipes/recipe-store.ts'

export interface AppProps {
  recipeStore: RecipeStore
  itemsPort: ItemsPort
}

export function App({ recipeStore, itemsPort }: AppProps) {
  return <HomeScreen recipeStore={recipeStore} itemsPort={itemsPort} />
}
