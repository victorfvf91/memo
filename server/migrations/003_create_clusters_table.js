exports.up = function(knex) {
  return knex.schema.createTable('clusters', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description');
    table.text('synthesized_summary');
    table.jsonb('summary_citations').defaultTo('[]'); // Array of citations linking claims to sources
    table.jsonb('conflicts').defaultTo('[]'); // Array of detected conflicts
    table.integer('item_count').defaultTo(0);
    table.decimal('coherence_score', 3, 2).defaultTo(0); // 0-1 score of cluster coherence
    table.boolean('is_auto_generated').defaultTo(true);
    table.timestamp('last_updated').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for performance
    table.index('user_id');
    table.index('name');
    table.index('coherence_score');
    table.index('last_updated');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('clusters');
}; 