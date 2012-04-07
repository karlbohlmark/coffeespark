spark = require './spark'

res = spark.render("""
	<div class="test"><span>${title}</span><div partial="magicpartial" each="product in products">${product.name}<span each="tag in product.tags">${tag}</span></div></div>
	"""
	,	{
		title: 'test'
		products: [
			{
				name:'asdf'
				tags:['cool'] 
			}
		]
	}
)


console.log res

#spark.render('<div>${name}</div>',{name:'Martina'})




