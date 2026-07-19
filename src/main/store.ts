import { openDatabase, type Db } from './db/connection'
import { TemplatesRepository } from './repositories/templates'
import { ProvidersRepository } from './repositories/providers'
import { SessionsRepository } from './repositories/sessions'
import { MessagesRepository } from './repositories/messages'
import { FilesRepository } from './repositories/files'

// The data-access layer bundled behind one object, constructed from a database
// handle. Handlers and the engine depend on this; tests build one over an
// in-memory database.
export interface Store {
  db: Db
  templates: TemplatesRepository
  providers: ProvidersRepository
  sessions: SessionsRepository
  messages: MessagesRepository
  files: FilesRepository
}

export function createStoreFromDb(db: Db): Store {
  return {
    db,
    templates: new TemplatesRepository(db),
    providers: new ProvidersRepository(db),
    sessions: new SessionsRepository(db),
    messages: new MessagesRepository(db),
    files: new FilesRepository(db)
  }
}

/** Open the database at `filename` (or ':memory:') and build the store. */
export function createStore(filename: string): Store {
  return createStoreFromDb(openDatabase(filename))
}
