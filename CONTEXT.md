# Recipes

An offline-capable PWA for deciding what to cook from what the home catalogue says is at home; the
Household's recipe book sits behind that. The second app on the data platform
([nadav-alon/data-platform](https://github.com/nadav-alon/data-platform)), sharing the catalogue's
Household. Platform terms (Household, Member, Owner, Item, State, State history, Soft delete) are
defined in the platform's `CONTEXT.md` and used here unchanged.

## Language

**Catalogue**:
The home catalogue app, and the record it keeps of every Item the Household has and its State. The
only source this app trusts for what is at home. Items are created there, never here.
_Avoid_: pantry, inventory, stock

**Household**:
The platform's Household, shared with the home catalogue: same Members, same Invites. This app
manages no membership of its own.

**Recipe**:
A dish the Household cooks: a title, ordered Ingredients, optional Prep Steps, Steps, and optionally
Servings, a source link and notes. Its id never changes, it is never versioned, and it is removed
only by Soft delete, so anything that points at it keeps pointing at the same Recipe.
_Avoid_: dish, meal

**Prep Step**:
A preparation instruction done before cooking starts ("slice the onions", "marinate 2h").
_Avoid_: mise en place

**Step**:
A cooking instruction, in order, after any Prep Steps.
_Avoid_: instruction, direction

**Servings**:
How many portions a Recipe makes as written.
_Avoid_: yield, portions

**Ingredient**:
One line of a Recipe: a display name, at most one linked Item, and optionally a quantity, a unit
from a fixed set, and a prep note ("sliced"). Its quantity belongs to the Recipe alone; the catalogue never holds quantities.
_Avoid_: component

**Linked Ingredient**:
An Ingredient pointing at an Item, so the Item's State speaks for it.

**Unlinked Ingredient**:
An Ingredient with no Item. Counts as Missing unless it is Assumed. Never auto-creates an Item; it
offers creating one in the Catalogue, which links back to it.

**Assumed Ingredient**:
An Ingredient someone has explicitly marked as always at hand (water). It has no Item, is never
checked and never Missing. Only marked Ingredients are Assumed; being Unlinked alone never makes one.

### Makeability

**Missing**:
An Ingredient that is not Assumed and is Unlinked, linked to an Item at `out`, or linked to an Item
the Catalogue has soft-deleted (shown as such, so it can be relinked). An Item at `running low`
counts as at home, and the Recipe shows that Ingredient flagged.
_Avoid_: needed, out (for the Ingredient)

**Makeable**:
A Recipe with no Missing Ingredient.
_Avoid_: can make, available

**Almost makeable**:
A Recipe with one or two Missing Ingredients, ranked by how few.

### Wanted

**Wanted Recipe**:
A Recipe marked "want to make". The mark is stored on the Recipe, so the whole Household shares it,
and it is cleared only by hand: nothing un-marks a Recipe on its own.
_Avoid_: favourite, planned, queued
