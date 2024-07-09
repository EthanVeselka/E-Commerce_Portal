function ingredientSearchKeydown(e) {
    // if enter was hit
    if(e.keyCode == 13) {
        ingredientSearch();
    }
    // otherwise do nothing
}

function ingredientSearchButtonClicked() {
    ingredientSearch();
}

/**
 * Will reset the search, reverting all colors to normal.
 */
function reset() {

    // remove all warnings
    document.querySelectorAll('.warning').forEach(e => e.remove());

    // remove text-danger from ingredients
    var allIngredients = document.getElementsByClassName("mb-1");
    for(var ingredient of allIngredients) {
        ingredient.classList.remove("text-danger");
        console.log(ingredient.innerHTML);
    }
}

function cleanString(str) {
    // to lower, followed by
    // magic regex to remove whitespace
    return str.toLowerCase().replace(/\s+/g, '');
}

function ingredientSearch() {

    reset();

    console.log("searchign);");

    var searchString = document.getElementById("ingredientSearchBox").value;
    searchString = cleanString(searchString);

    var forbiddenIngredients = searchString.split(",");

    // foreach forbidden ingredient
    for(var forbiddenIngredient of forbiddenIngredients) 
    {
        // color and bold the instances where it appears
        var allIngredients = document.getElementsByClassName("mb-1");
        for(var ingredient of allIngredients) {
            var ingredientName = ingredient.innerHTML;

            if(ingredientName.id == "smoothieName")
            {
                // continue, this is actually a smoothie title, not an ingredient
                continue;
            }

            ingredientName = cleanString(ingredientName.replace(/\s+/g, ''))
            ingredientName = ingredientName.replace(',', '');

            console.log(ingredientName);

            if(ingredientName == forbiddenIngredient) {
                ingredient.classList.add("text-danger");

                // mark the whole smoothie's tile as forbidden too
                var smoothieTile = ingredient.parentElement;
                var warning = document.createElement("p");
                warning.innerHTML = "<i>WARNING:</i> This smoothie contains a forbidden ingredient.";
                warning.classList.add("text-danger");
                warning.classList.add("warning");
                smoothieTile.appendChild(warning);
            }
        }
    }
}