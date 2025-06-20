exports.up = function(knex) {
  return knex.schema.createTable('content', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('url').notNullable();
    table.string('title').notNullable();
    table.text('full_text');
    table.jsonb('metadata').defaultTo('{}');
    table.jsonb('embeddings').defaultTo('[]');
    table.string('processing_status').defaultTo('pending'); // pending, processing, completed, failed
    table.string('content_type').defaultTo('article'); // article, video, pdf, social
    table.integer('reading_time_estimate');
    table.string('author');
    table.string('domain');
    table.timestamp('published_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for performance
    table.index('user_id');
    table.index('url');
    table.index('processing_status');
    table.index('content_type');
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('content');
}; 